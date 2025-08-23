import express from 'express';
import {
    sendMessage,
    getChatHistory,
    getChatSessions,
    deleteMessage,
    markMessageAsRead,
    getUnreadCount
} from '../controllers/messageController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// 所有路由都需要认证
router.use(authMiddleware);

// 测试路由
router.get('/test', (req, res) => {
            res.json({ message: 'Message route is working', userId: req.user.userId });
});

// 发送消息
router.post('/send', sendMessage);

// 获取与特定用户的聊天记录
router.get('/chat/:targetUserId', getChatHistory);

// 获取用户的聊天会话列表
router.get('/sessions', getChatSessions);

// 删除消息
router.delete('/:messageId', deleteMessage);

// 标记消息为已读
router.put('/:messageId/read', markMessageAsRead);

// 获取未读消息数
router.get('/unread/count', getUnreadCount);

export default router;
