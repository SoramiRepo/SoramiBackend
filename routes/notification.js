import express from 'express';
import Notification from '../models/Notification.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create', authMiddleware, async (req, res) => {
    const { type, to, post, message } = req.body;

    if (!type || !to) {
        return res.status(400).json({ success: false, message: 'Missing required fields: type or to' });
    }

    try {
        const notification = await Notification.create({
            type,
            from: req.userId,
            to,
            post,
            message,
        });
        res.status(201).json({ success: true, notification });
    } catch (err) {
        console.error('Failed to create notification:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const notifications = await Notification.find({ to: req.userId })
            .sort({ createdAt: -1 })
            .populate('from', 'username avatarname avatarimg')
            .populate('post', 'content');

        res.json({ success: true, notifications });
    } catch (err) {
        console.error('Failed to fetch notifications:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ to: req.userId, isRead: false });
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.patch('/read/:id', authMiddleware, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, to: req.userId },
            { isRead: true },
            { new: true }
        );
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.patch('/mark-all-read', authMiddleware, async (req, res) => {
    try {
        await Notification.updateMany(
            { to: req.userId, isRead: false },
            { isRead: true }
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
