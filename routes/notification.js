import express from 'express';
import Notification from '../models/Notification.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// 创建通知
router.post('/create', authMiddleware, async (req, res) => {
    const { type, to, post, message } = req.body;

    if (!type || !to) {
        return res.status(400).json({ message: '缺少必要字段 type 或 to' });
    }

    try {
        const notification = new Notification({
            type,
            from: req.userId,
            to,
            post,
            message,
        });
        await notification.save();
        res.status(201).json({ notification });
    } catch (err) {
        console.error('创建通知失败:', err);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 获取当前用户的所有通知
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const notifications = await Notification.find({ to: req.userId })
            .sort({ createdAt: -1 })
            .populate('from', 'username avatarname avatarimg')
            .populate('post', 'content');

        res.json({ notifications });
    } catch (err) {
        console.error('获取通知失败:', err);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 将某条通知标记为已读
router.post('/read/:id', authMiddleware, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, to: req.userId },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: '通知不存在或无权限' });
        }

        res.json({ notification });
    } catch (err) {
        console.error('标记通知失败:', err);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 标记全部通知为已读
router.post('/read-all', authMiddleware, async (req, res) => {
    try {
        await Notification.updateMany({ to: req.userId, isRead: false }, { isRead: true });
        res.json({ message: '全部通知已标记为已读' });
    } catch (err) {
        console.error('标记全部通知失败:', err);
        res.status(500).json({ message: '服务器错误' });
    }
});

export default router;
