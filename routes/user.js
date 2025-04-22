import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import authMiddleware from '../middleware/authMiddleware.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// 工具函数：根据 ID 查找用户
const findUserById = async (id) => await User.findById(id);

// 工具函数：生成 Token
const generateToken = (user) =>
    jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

// 登录
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ message: '用户名和密码不能为空' });

    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ message: '用户名不存在' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: '密码错误' });

        const token = generateToken(user);
        res.json({
            message: '登录成功',
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
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 注册
router.post('/register', async (req, res) => {
    const isAllowed = false; // 设置是否允许注册

    if (!isAllowed) {
        return res.status(400).json({ message: '当前不可注册' });
    }

    const { username, password, avatarname, avatarimg, bio } = req.body;
    if (!username || !password)
        return res.status(400).json({ message: '用户名和密码不能为空' });

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser)
            return res.status(400).json({ message: '用户名已存在' });

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
            message: '注册成功',
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
    } catch (err) {
        console.error('Register Error:', err);
        res.status(500).json({ message: '服务器错误' });
    }
});


// 搜索用户
router.get('/search', async (req, res) => {
    const { keyword } = req.query;
    if (!keyword || typeof keyword !== 'string')
        return res.status(400).json({ message: '无效关键词' });

    try {
        const regex = new RegExp(keyword, 'i');
        const users = await User.find({
            $or: [
                { username: regex },
                { avatarname: regex }
            ]
        }).select('username avatarname avatarimg badges followers following');

        res.json({ users });
    } catch (err) {
        console.error('搜索用户错误:', err);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 用户编辑Profile
router.put('/edit-profile', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];  // 获取 Bearer token
    if (!token) return res.status(401).json({ message: 'Not logged in' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const { avatarname, avatarimg } = req.body;

        // 查找用户并更新头像和用户名
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // 仅更新传入的字段
        if (avatarname) user.avatarname = avatarname;
        if (avatarimg) user.avatarimg = avatarimg;

        await user.save();

        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// 关注
router.post('/follow/:targetId', authMiddleware, async (req, res) => {
    const { userId } = req;
    const { targetId } = req.params;

    if (userId === targetId) {
        return res.status(400).json({ message: '不能关注自己' });
    }

    try {
        const user = await User.findById(userId);
        const target = await User.findById(targetId);

        if (!user || !target) {
            return res.status(404).json({ message: '用户未找到' });
        }

        // 判断是否已关注
        const alreadyFollowing = user.following.some(id => id.toString() === targetId);
        if (alreadyFollowing) {
            return res.status(400).json({ message: '已关注该用户' });
        }

        // 更新数据库：添加关注
        await User.findByIdAndUpdate(userId, {
            $addToSet: { following: target._id }
        });

        await User.findByIdAndUpdate(targetId, {
            $addToSet: { followers: user._id }
        });

        console.log('User following:', user.following);
        console.log('Target followers:', target.followers);

        res.json({ message: '关注成功' });
    } catch (err) {
        console.error('关注失败:', err);
        res.status(500).json({ message: '服务器错误' });
    }
});


// 取消关注
router.post('/unfollow/:targetId', authMiddleware, async (req, res) => {
    const { userId } = req;
    const { targetId } = req.params;

    try {
        const user = await findUserById(userId);
        const target = await findUserById(targetId);

        if (!user || !target)
            return res.status(404).json({ message: '用户未找到' });

        user.following = user.following.filter(id => id.toString() !== targetId);
        target.followers = target.followers.filter(id => id.toString() !== userId);

        await user.save();
        await target.save();

        console.log('User following:', user.following);
        console.log('Target followers:', target.followers);

        res.json({ message: '取消关注成功' });
    } catch (err) {
        console.error('取消关注错误:', err);
        res.status(500).json({ message: '服务器错误' });
    }
});

// ⚠ 下面的所有代码都应当放到最下面

// 获取用户信息，包括关注数和关注列表
router.get('/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const user = await User.findOne({ username }).populate('followers', 'username avatarname avatarimg badges').populate('following', 'username avatarname avatarimg badges');
        if (!user)
            return res.status(404).json({ message: '用户不存在' });

        res.json({
            user: {
                _id: user._id,
                username: user.username,
                avatarname: user.avatarname,
                avatarimg: user.avatarimg,
                bio: user.bio,
                registertime: user.registertime,
                followersCount: user.followers.length,
                followingCount: user.following.length, 
                followers: user.followers, 
                following: user.following,
                badges: user.badges,

                // 判断是否互相关注
                followerIds: user.followers.map(f => f._id.toString()),
                followingIds: user.following.map(f => f._id.toString()),
            }
        });
    } catch (err) {
        console.error('获取用户信息错误:', err);
        res.status(500).json({ message: '服务器错误' });
    }
});

export default router;
