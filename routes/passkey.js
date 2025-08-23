import express from 'express';
import Passkey from '../models/Passkey.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/authMiddleware.js';
import {
    generatePasskeyRegistrationOptions,
    verifyPasskeyRegistration,
    generatePasskeyAuthenticationOptions,
    verifyPasskeyAuthentication,
    generateChallenge,
    isChallengeExpired,
    getRPID,
    getRPOrigin
} from '../utils/passkeyUtils.js';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const DEBUG = process.env.DEBUG || false;

// 存储挑战的临时存储（生产环境应使用Redis）
const challenges = new Map();

// 生成passkey注册选项
router.post('/generate-registration-options', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // 生成注册选项（让库自动生成挑战）
        const { options, rpID, rpOrigin } = await generatePasskeyRegistrationOptions(user);
        
        // 从options中获取库生成的挑战并存储
        const challenge = options.challenge;
        challenges.set(challenge, {
            userId,
            type: 'registration',
            timestamp: new Date(),
            rpID,
            rpOrigin
        });

        // 设置挑战过期时间（5分钟后自动清理）
        setTimeout(() => {
            challenges.delete(challenge);
        }, 5 * 60 * 1000);

        if (DEBUG) {
            console.log('Generated registration options for user:', userId);
        }

        res.json({
            options,
            challenge,
            rpID,
            rpOrigin
        });
    } catch (error) {
        console.error('Error generating registration options:', error);
        res.status(500).json({ message: 'Failed to generate registration options.' });
    }
});

// 验证passkey注册
router.post('/verify-registration', authMiddleware, async (req, res) => {
    try {
        const { response } = req.body;
        
        if (!response) {
            return res.status(400).json({ message: 'Response is required.' });
        }

        // 从WebAuthn响应中提取挑战
        // 根据WebAuthn规范，挑战信息在response.clientDataJSON中
        let challenge;
        try {
            const clientData = JSON.parse(Buffer.from(response.clientDataJSON, 'base64').toString());
            challenge = clientData.challenge;
        } catch (e) {
            console.error('Failed to parse clientDataJSON:', e);
            return res.status(400).json({ message: 'Invalid WebAuthn response format.' });
        }

        console.log('Extracted challenge from response:', challenge);
        const challengeData = challenges.get(challenge);
        if (!challengeData || challengeData.type !== 'registration') {
            return res.status(400).json({ message: 'Invalid or expired challenge.' });
        }

        if (isChallengeExpired(challengeData.timestamp)) {
            challenges.delete(challenge);
            return res.status(400).json({ message: 'Challenge has expired.' });
        }

        const { userId, rpID, rpOrigin } = challengeData;
        const user = await User.findById(userId);
        
        if (!user) {
            challenges.delete(challenge);
            return res.status(404).json({ message: 'User not found.' });
        }

        // 验证注册响应
        // 根据WebAuthn规范，我们使用从响应中提取的挑战进行验证
        const verification = await verifyPasskeyRegistration(
            response,
            challenge, // 使用从响应中提取的挑战
            rpOrigin,
            rpID
        );

        if (verification.verified) {
            // 保存passkey到数据库
            const passkey = new Passkey({
                userId,
                credentialID: isoBase64URL.fromBuffer(verification.registrationInfo.credentialID),
                publicKey: isoBase64URL.fromBuffer(verification.registrationInfo.credentialPublicKey),
                counter: verification.registrationInfo.counter,
                transports: response.response.transports || ['internal']
            });

            await passkey.save();
            
            // 清理挑战
            challenges.delete(challenge);

            if (DEBUG) {
                console.log('Passkey registered successfully for user:', userId);
            }

            res.json({ 
                message: 'Passkey registered successfully.',
                verified: true 
            });
        } else {
            res.status(400).json({ 
                message: 'Passkey registration verification failed.',
                verified: false 
            });
        }
    } catch (error) {
        console.error('Error verifying registration:', error);
        res.status(500).json({ message: 'Failed to verify registration.' });
    }
});

// 生成passkey认证选项
router.post('/generate-authentication-options', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ message: 'Username is required.' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // 获取用户的passkeys
        const userPasskeys = await Passkey.find({ userId: user._id });
        
        if (userPasskeys.length === 0) {
            return res.status(400).json({ message: 'No passkeys found for this user.' });
        }

        const { options, rpID, rpOrigin } = await generatePasskeyAuthenticationOptions(userPasskeys);
        
        // 从options中获取库生成的挑战并存储
        const challenge = options.challenge;
        challenges.set(challenge, {
            userId: user._id.toString(),
            username: user.username,
            type: 'authentication',
            timestamp: new Date(),
            rpID,
            rpOrigin
        });

        // 设置挑战过期时间
        setTimeout(() => {
            challenges.delete(challenge);
        }, 5 * 60 * 1000);

        if (DEBUG) {
            console.log('Generated authentication options for user:', username);
        }

        res.json({
            options,
            challenge,
            rpID,
            rpOrigin
        });
    } catch (error) {
        console.error('Error generating authentication options:', error);
        res.status(500).json({ message: 'Failed to generate authentication options.' });
    }
});

// 验证passkey认证
router.post('/verify-authentication', async (req, res) => {
    try {
        const { response } = req.body;
        
        if (!response) {
            return res.status(400).json({ message: 'Response is required.' });
        }

        // 从WebAuthn响应中提取挑战
        // 根据WebAuthn规范，挑战信息在response.clientDataJSON中
        let challenge;
        try {
            const clientData = JSON.parse(Buffer.from(response.clientDataJSON, 'base64').toString());
            challenge = clientData.challenge;
        } catch (e) {
            console.error('Failed to parse clientDataJSON:', e);
            return res.status(400).json({ message: 'Invalid WebAuthn response format.' });
        }

        console.log('Extracted challenge from response:', challenge);
        const challengeData = challenges.get(challenge);
        if (!challengeData || challengeData.type !== 'authentication') {
            return res.status(400).json({ message: 'Invalid or expired challenge.' });
        }

        if (isChallengeExpired(challengeData.timestamp)) {
            challenges.delete(challenge);
            return res.status(400).json({ message: 'Challenge has expired.' });
        }

        const { userId, username, rpID, rpOrigin } = challengeData;
        const user = await User.findById(userId);
        
        if (!user) {
            challenges.delete(challenge);
            return res.status(404).json({ message: 'User not found.' });
        }

        // 查找对应的passkey
        const passkey = await Passkey.findOne({ 
            userId, 
            credentialID: response.id 
        });

        if (!passkey) {
            challenges.delete(challenge);
            return res.status(400).json({ message: 'Invalid passkey.' });
        }

        // 验证认证响应
        // 使用存储的原始挑战进行验证
        const verification = await verifyPasskeyAuthentication(
            response,
            challenge, // 使用存储的原始挑战
            rpOrigin,
            rpID,
            passkey
        );

        if (verification.verified) {
            // 更新计数器
            passkey.counter = verification.authenticationInfo.newCounter;
            passkey.lastUsed = new Date();
            await passkey.save();

            // 生成JWT token
            const jwt = (await import('jsonwebtoken')).default;
            const token = jwt.sign(
                { userId: user._id, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // 清理挑战
            challenges.delete(challenge);

            if (DEBUG) {
                console.log('Passkey authentication successful for user:', username);
            }

            res.json({
                message: 'Authentication successful.',
                verified: true,
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    avatarname: user.avatarname,
                    avatarimg: user.avatarimg,
                    bio: user.bio,
                    registertime: user.registertime,
                }
            });
        } else {
            res.status(400).json({ 
                message: 'Passkey authentication verification failed.',
                verified: false 
            });
        }
    } catch (error) {
        console.error('Error verifying authentication:', error);
        res.status(500).json({ message: 'Failed to verify authentication.' });
    }
});

// 获取用户的passkeys
router.get('/list', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userPasskeys = await Passkey.find({ userId }).select('-publicKey');
        
        res.json({
            passkeys: userPasskeys.map(pk => ({
                id: pk._id,
                credentialID: pk.credentialID,
                transports: pk.transports,
                createdAt: pk.createdAt,
                lastUsed: pk.lastUsed
            }))
        });
    } catch (error) {
        console.error('Error listing passkeys:', error);
        res.status(500).json({ message: 'Failed to list passkeys.' });
    }
});

// 删除passkey
router.delete('/:passkeyId', authMiddleware, async (req, res) => {
    try {
        const { passkeyId } = req.params;
        const userId = req.user.userId;
        
        const passkey = await Passkey.findOne({ _id: passkeyId, userId });
        
        if (!passkey) {
            return res.status(404).json({ message: 'Passkey not found.' });
        }

        await Passkey.findByIdAndDelete(passkeyId);
        
        if (DEBUG) {
            console.log('Passkey deleted for user:', userId);
        }

        res.json({ message: 'Passkey deleted successfully.' });
    } catch (error) {
        console.error('Error deleting passkey:', error);
        res.status(500).json({ message: 'Failed to delete passkey.' });
    }
});

// 检查用户是否有passkeys
router.get('/check/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const passkeyCount = await Passkey.countDocuments({ userId: user._id });
        
        res.json({
            hasPasskeys: passkeyCount > 0,
            count: passkeyCount
        });
    } catch (error) {
        console.error('Error checking passkeys:', error);
        res.status(500).json({ message: 'Failed to check passkeys.' });
    }
});

export default router;
