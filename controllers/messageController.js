import Message from '../models/Message.js';
import ChatSession from '../models/ChatSession.js';
import User from '../models/User.js';

// 发送消息
export const sendMessage = async (req, res) => {
    try {
        const { receiverId, content, messageType = 'text' } = req.body;
        const senderId = req.userId;

        // 验证输入参数
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ message: 'Valid message content is required' });
        }
        
        if (content.length > 1000) {
            return res.status(400).json({ message: 'Message content too long (max 1000 characters)' });
        }
        
        if (!receiverId || typeof receiverId !== 'string') {
            return res.status(400).json({ message: 'Valid receiver ID is required' });
        }
        
        if (!['text', 'image', 'file'].includes(messageType)) {
            return res.status(400).json({ message: 'Invalid message type' });
        }

        // 验证接收者是否存在
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({ message: 'Receiver not found' });
        }

        // 不能给自己发消息
        if (senderId === receiverId) {
            return res.status(400).json({ message: 'Cannot send message to yourself' });
        }

        // 创建或获取聊天会话
        const session = await ChatSession.findOrCreateSession(senderId, receiverId);

        // 创建消息
        const message = new Message({
            sender: senderId,
            receiver: receiverId,
            content,
            messageType
        });

        await message.save();

        // 更新会话信息
        session.lastMessage = message._id;
        session.lastMessageAt = new Date();
        await session.incrementUnreadCount(receiverId);
        await session.save();

        // 填充发送者信息
        await message.populate('sender', 'username avatarname avatarimg');

        res.status(201).json({
            message: 'Message sent successfully',
            data: message
        });

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ message: 'Failed to send message' });
    }
};

// 获取与特定用户的聊天记录
export const getChatHistory = async (req, res) => {
    try {
        const { targetUserId } = req.params;
        const currentUserId = req.userId;
        const { page = 1, limit = 50 } = req.query;
        
        // 验证分页参数
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({ message: 'Invalid page number' });
        }
        
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({ message: 'Invalid limit (must be between 1 and 100)' });
        }

        // 验证目标用户是否存在
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'Target user not found' });
        }

        // 查找聊天会话
        const session = await ChatSession.findOne({
            participants: { $all: [currentUserId, targetUserId] }
        });

        if (!session) {
            return res.json({
                messages: [],
                session: null,
                pagination: { page: 1, limit, total: 0, pages: 0 }
            });
        }

        // 获取消息
        const skip = (pageNum - 1) * limitNum;
        const messages = await Message.find({
            $or: [
                { sender: currentUserId, receiver: targetUserId },
                { sender: targetUserId, receiver: currentUserId }
            ],
            deletedFor: { $ne: currentUserId }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('sender', 'username avatarname avatarimg')
        .populate('receiver', 'username avatarname avatarimg');

        // 获取总数
        const total = await Message.countDocuments({
            $or: [
                { sender: currentUserId, receiver: targetUserId },
                { sender: targetUserId, receiver: currentUserId }
            ],
            deletedFor: { $ne: currentUserId }
        });

        // 标记消息为已读
        await Message.updateMany(
            {
                sender: targetUserId,
                receiver: currentUserId,
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        // 重置未读消息数
        if (session) {
            await session.resetUnreadCount(currentUserId);
        }

        res.json({
            messages: messages.reverse(), // 按时间正序返回
            session,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        console.error('Get chat history error:', error);
        res.status(500).json({ message: 'Failed to get chat history' });
    }
};

// 获取用户的聊天会话列表
export const getChatSessions = async (req, res) => {
    try {
        const currentUserId = req.userId;
        const { page = 1, limit = 20 } = req.query;
        
        // 验证分页参数
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({ message: 'Invalid page number' });
        }
        
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
            return res.status(400).json({ message: 'Invalid limit (must be between 1 and 50)' });
        }

        const skip = (pageNum - 1) * limitNum;

        // 查找用户的聊天会话
        const sessions = await ChatSession.find({
            participants: currentUserId,
            isActive: true
        })
        .populate('participants', 'username avatarname avatarimg')
        .populate('lastMessage')
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        // 获取总数
        const total = await ChatSession.countDocuments({
            participants: currentUserId,
            isActive: true
        });

        // 处理会话数据，隐藏当前用户信息
        const processedSessions = sessions.map(session => {
            const otherParticipant = session.participants.find(
                p => p._id.toString() !== currentUserId.toString()
            );
            
            return {
                _id: session._id,
                otherUser: otherParticipant,
                lastMessage: session.lastMessage,
                lastMessageAt: session.lastMessageAt,
                unreadCount: session.getUnreadCount(currentUserId),
                userSettings: session.userSettings.get(currentUserId.toString()),
                createdAt: session.createdAt
            };
        });

        res.json({
            sessions: processedSessions,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        console.error('Get chat sessions error:', error);
        res.status(500).json({ message: 'Failed to get chat sessions' });
    }
};

// 删除消息
export const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const currentUserId = req.userId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // 只能删除自己发送的消息
        if (message.sender.toString() !== currentUserId.toString()) {
            return res.status(403).json({ message: 'Cannot delete message from others' });
        }

        // 软删除：添加到deletedFor数组
        if (!message.deletedFor.includes(currentUserId)) {
            message.deletedFor.push(currentUserId);
            await message.save();
        }

        res.json({ message: 'Message deleted successfully' });

    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ message: 'Failed to delete message' });
    }
};

// 标记消息为已读
export const markMessageAsRead = async (req, res) => {
    try {
        const { messageId } = req.params;
        const currentUserId = req.userId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // 只能标记发给自己的消息为已读
        if (message.receiver.toString() !== currentUserId.toString()) {
            return res.status(403).json({ message: 'Cannot mark others message as read' });
        }

        message.isRead = true;
        message.readAt = new Date();
        await message.save();

        res.json({ message: 'Message marked as read' });

    } catch (error) {
        console.error('Mark message as read error:', error);
        res.status(500).json({ message: 'Failed to mark message as read' });
    }
};

// 获取未读消息数
export const getUnreadCount = async (req, res) => {
    try {
        const currentUserId = req.userId;

        const sessions = await ChatSession.find({
            participants: currentUserId,
            isActive: true
        });

        const totalUnread = sessions.reduce((total, session) => {
            return total + session.getUnreadCount(currentUserId);
        }, 0);

        res.json({ unreadCount: totalUnread });

    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ message: 'Failed to get unread count' });
    }
};
