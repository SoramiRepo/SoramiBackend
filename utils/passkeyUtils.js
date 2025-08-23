import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';

// 获取当前域名（用于RP ID）
export const getRPID = () => {
    const rpID = process.env.RP_ID || 'localhost';
    return rpID;
};

// 获取RP Origin
export const getRPOrigin = () => {
    const rpOrigin = process.env.RP_ORIGIN || 'http://localhost:3000';
    return rpOrigin;
};

// 生成注册选项
export const generatePasskeyRegistrationOptions = async (user) => {
    const rpID = getRPID();
    const rpOrigin = getRPOrigin();
    
    const options = await generateRegistrationOptions({
        rpName: 'Sorami',
        rpID,
        userID: new TextEncoder().encode(user._id.toString()),
        userName: user.username,
        userDisplayName: user.avatarname || user.username,
        attestationType: 'none',
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
        },
        supportedAlgorithmIDs: [-7, -257], // ES256, RS256
        // 不显式设置挑战，让库自动生成
    });

    return {
        options,
        rpID,
        rpOrigin
    };
};

// 验证注册响应
export const verifyPasskeyRegistration = async (response, expectedChallenge, expectedOrigin, expectedRPID) => {
    try {
        // 确保挑战格式正确
        let challengeToUse = expectedChallenge;

        // 挑战现在总是库生成的格式，需要正确处理
        if (typeof expectedChallenge === 'string') {
            try {
                // 尝试解码为Buffer（支持Base64URL格式）
                challengeToUse = isoBase64URL.toBuffer(expectedChallenge);
            } catch (e) {
                console.error('Failed to decode challenge:', e);
                throw new Error('Invalid challenge format');
            }
        } else if (expectedChallenge instanceof Uint8Array) {
            // 如果挑战已经是Uint8Array，直接使用
            challengeToUse = expectedChallenge;
        }

        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: challengeToUse,
            expectedOrigin,
            expectedRPID,
            requireUserVerification: false,
        });

        return verification;
    } catch (error) {
        console.error('Passkey registration verification failed:', error);
        throw error;
    }
};

// 生成认证选项
export const generatePasskeyAuthenticationOptions = async (userPasskeys) => {
    const rpID = getRPID();
    const rpOrigin = getRPOrigin();
    
    const allowCredentials = userPasskeys.map(passkey => ({
        id: isoBase64URL.toBuffer(passkey.credentialID),
        type: 'public-key',
        transports: passkey.transports || ['internal']
    }));

    const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials,
        userVerification: 'preferred',
        timeout: 60000,
        // 不显式设置挑战，让库自动生成
    });

    return {
        options,
        rpID,
        rpOrigin
    };
};

// 验证认证响应
export const verifyPasskeyAuthentication = async (response, expectedChallenge, expectedOrigin, expectedRPID, userPasskey) => {
    try {
        // 确保挑战格式正确
        let challengeToUse = expectedChallenge;

        // 挑战现在总是库生成的格式，需要正确处理
        if (typeof expectedChallenge === 'string') {
            try {
                // 尝试解码为Buffer（支持Base64URL格式）
                challengeToUse = isoBase64URL.toBuffer(expectedChallenge);
            } catch (e) {
                console.error('Failed to decode challenge:', e);
                throw new Error('Invalid challenge format');
            }
        } else if (expectedChallenge instanceof Uint8Array) {
            // 如果挑战已经是Uint8Array，直接使用
            challengeToUse = expectedChallenge;
        }

        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: challengeToUse,
            expectedOrigin,
            expectedRPID,
            authenticator: {
                credentialPublicKey: isoBase64URL.toBuffer(userPasskey.publicKey),
                credentialID: isoBase64URL.toBuffer(userPasskey.credentialID),
                counter: userPasskey.counter,
            },
            requireUserVerification: false,
        });

        return verification;
    } catch (error) {
        console.error('Passkey authentication verification failed:', error);
        throw error;
    }
};

// 生成随机挑战
export const generateChallenge = () => {
    // 使用UUID作为挑战标识符
    // 这样可以确保挑战在存储和传输过程中保持一致性
    return crypto.randomUUID();
};

// 验证挑战是否过期（5分钟）
export const isChallengeExpired = (challengeTime) => {
    const now = Date.now();
    const challengeTimestamp = new Date(challengeTime).getTime();
    const fiveMinutes = 5 * 60 * 1000;
    
    return (now - challengeTimestamp) > fiveMinutes;
};
