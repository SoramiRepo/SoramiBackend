import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import authMiddleware from '../middleware/authMiddleware.js';
import dotenv from 'dotenv';
dotenv.config();

const DEBUG = process.env.DEBUG || false;

const router = express.Router();

// Tool function: look up user by ID
const findUserById = async (id) => await User.findById(id);

// Tool function: generate JWT token
const generateToken = (user) =>

    jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const token = generateToken(user);

        if (DEBUG) {
            console.log('Login successful:', {
                userId: user._id,
                username: user.username,
                token,
            });
        }

        res.json({
            message: 'Login successful.',
            token,
            user: {
                id: user._id,
                username: user.username,
                avatarname: user.avatarname,
                avatarimg: user.avatarimg,
                bio: user.bio,
                registertime: user.registertime,
            },
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

router.post('/register', async (req, res) => {
    const isAllowed = process.env.ALLOW_REGISTER === 'true';

    if (!isAllowed) {
        return res.status(403).json({ message: 'Registration is currently disabled.' });
    }

    const { username, password, avatarname, avatarimg, bio } = req.body;

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            password: hashedPassword,
            avatarname: avatarname || '',
            avatarimg: avatarimg || '',
            bio: bio || '',
            registertime: new Date(),
        });

        await newUser.save();
        const token = generateToken(newUser);

        res.status(201).json({
            message: 'Registration successful.',
            token,
            user: {
                id: newUser._id,
                username: newUser.username,
                avatarname: newUser.avatarname,
                avatarimg: newUser.avatarimg,
                bio: newUser.bio,
                registertime: newUser.registertime,
            },
        });
    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


router.get('/search', async (req, res) => {
    const { keyword } = req.query;

    if (typeof keyword !== 'string' || !keyword.trim()) {
        return res.status(400).json({ message: 'Invalid search keyword.' });
    }

    try {
        const regex = new RegExp(keyword.trim(), 'i');

        const users = await User.find({
            $or: [
                { username: regex },
                { avatarname: regex }
            ]
        }).select('username avatarname avatarimg badges followers following');

        res.json({ users });
    } catch (error) {
        console.error('User search error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

router.put('/edit-profile', authMiddleware, async (req, res) => {
    try {
        const { avatarname, avatarimg } = req.body;

        if (!avatarname && !avatarimg) {
            return res.status(400).json({ message: 'No data to update.' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (avatarname) user.avatarname = avatarname;
        if (avatarimg) user.avatarimg = avatarimg;

        await user.save();

        res.json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

router.post('/follow/:targetId', authMiddleware, async (req, res) => {
    const { userId } = req;
    const { targetId } = req.params;

    if (userId === targetId) {
        return res.status(400).json({ message: 'You cannot follow yourself.' });
    }

    try {
        const [user, target] = await Promise.all([
            User.findById(userId),
            User.findById(targetId)
        ]);

        if (!user || !target) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const alreadyFollowing = user.following.includes(target._id);
        if (alreadyFollowing) {
            return res.status(400).json({ message: 'You are already following this user.' });
        }

        await Promise.all([
            User.findByIdAndUpdate(userId, {
                $addToSet: { following: target._id }
            }),
            User.findByIdAndUpdate(targetId, {
                $addToSet: { followers: user._id }
            })
        ]);

        res.json({ message: 'Followed successfully.' });
    } catch (error) {
        console.error('Follow error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

router.post('/unfollow/:targetId', authMiddleware, async (req, res) => {
    const { userId } = req;
    const { targetId } = req.params;

    if (userId === targetId) {
        return res.status(400).json({ message: 'You cannot unfollow yourself.' });
    }

    try {
        const [user, target] = await Promise.all([
            User.findById(userId),
            User.findById(targetId)
        ]);

        if (!user || !target) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isFollowing = user.following.includes(target._id);
        if (!isFollowing) {
            return res.status(400).json({ message: 'You are not following this user.' });
        }

        await Promise.all([
            User.findByIdAndUpdate(userId, {
                $pull: { following: target._id }
            }),
            User.findByIdAndUpdate(targetId, {
                $pull: { followers: user._id }
            })
        ]);

        res.json({ message: 'Unfollowed successfully.' });
    } catch (error) {
        console.error('Unfollow error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

router.get('/:username', async (req, res) => {
    const { username } = req.params;

    try {
        const user = await User.findOne({ username })
            .populate('followers', 'username avatarname avatarimg badges')
            .populate('following', 'username avatarname avatarimg badges');

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const followers = user.followers || [];
        const following = user.following || [];

        res.json({
            user: {
                _id: user._id,
                username: user.username,
                avatarname: user.avatarname,
                avatarimg: user.avatarimg,
                bio: user.bio,
                registertime: user.registertime,
                badges: user.badges,
                followersCount: followers.length,
                followingCount: following.length,
                followers,
                following,
                followerIds: followers.map(f => f._id.toString()),
                followingIds: following.map(f => f._id.toString())
            }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


export default router;
