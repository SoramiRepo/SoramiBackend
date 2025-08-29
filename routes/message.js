import express from 'express';
const router = express.Router();
import messageController from '../controllers/messageController.js';
import * as groupController from '../controllers/groupController.js';
import authMiddleware from '../middleware/authMiddleware.js';

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Message routes
router.post('/private', messageController.sendPrivateMessage);
router.post('/group', messageController.sendGroupMessage);
router.get('/chat/:chatId/history', messageController.getChatHistory);
router.get('/sessions', messageController.getChatSessions);
router.put('/:messageId/read', messageController.markMessageAsRead);
router.delete('/:messageId', messageController.deleteMessage);
router.get('/unread', messageController.getUnreadCount);
router.get('/search', messageController.searchMessages);

// Group routes
router.post('/groups', groupController.createGroup);
router.get('/groups', groupController.getGroups);
router.get('/groups/:groupId', groupController.getGroupDetails);
router.put('/groups/:groupId', groupController.updateGroup);
router.post('/groups/:groupId/join', groupController.joinGroup);
router.post('/groups/:groupId/leave', groupController.leaveGroup);
router.post('/groups/:groupId/members', groupController.addGroupMember);
router.delete('/groups/:groupId/members/:userId', groupController.removeGroupMember);
router.get('/groups/search', groupController.searchGroups);

export default router;
