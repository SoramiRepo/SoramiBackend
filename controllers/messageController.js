import Message from '../models/Message.js';
import ChatSession from '../models/ChatSession.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { validateObjectId } from '../utils/validation.js';
import logger from '../utils/logger.js';

class MessageController {
  // 发送私信
  async sendPrivateMessage(req, res) {
    try {
      const { receiverId, content, type = 'text', fileUrl, fileName, fileSize } = req.body;
      const senderId = req.user.id;

      // 验证参数
      if (!receiverId || !content) {
        return res.status(400).json({
          success: false,
          message: 'Receiver ID and content are required'
        });
      }

      if (!validateObjectId(receiverId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid receiver ID'
        });
      }

      // 检查接收者是否存在
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        return res.status(404).json({
          success: false,
          message: 'Receiver not found'
        });
      }

      // 不能给自己发消息
      if (senderId === receiverId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot send message to yourself'
        });
      }

      // 创建或获取聊天会话
      const chatSession = await ChatSession.createPrivateSession(senderId, receiverId);

      // 创建消息
      const message = await Message.createPrivateMessage({
        senderId,
        receiverId,
        content,
        type,
        fileUrl,
        fileName,
        fileSize
      });

      // 更新聊天会话的最后消息
      await chatSession.updateLastMessage(message);

      // 增加接收者的未读计数
      await chatSession.incrementUnreadCount(receiverId);

      // 返回消息
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'username avatarUrl')
        .populate('receiverId', 'username avatarUrl');

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: populatedMessage
      });

      // 通过WebSocket发送实时消息
      if (global.socketServer) {
        await global.socketServer.sendNewMessage(message, chatSession.chatId);
      }

    } catch (error) {
      logger.error('Error sending private message:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // 发送群组消息
  async sendGroupMessage(req, res) {
    try {
      const { groupId, content, type = 'text', fileUrl, fileName, fileSize } = req.body;
      const senderId = req.user.id;

      // 验证参数
      if (!groupId || !content) {
        return res.status(400).json({
          success: false,
          message: 'Group ID and content are required'
        });
      }

      if (!validateObjectId(groupId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid group ID'
        });
      }

      // 检查群组是否存在
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      // 检查用户是否是群组成员
      const isMember = group.members.some(member => 
        member.userId.equals(senderId) && member.isActive
      );

      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'You are not a member of this group'
        });
      }

      // 检查用户是否有发送消息的权限
      if (!group.hasPermission(senderId, 'send_message')) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to send messages in this group'
        });
      }

      // 创建或获取聊天会话
      let chatSession = await ChatSession.findOne({ chatId: `group_${groupId}` });
      
      if (!chatSession) {
        chatSession = await ChatSession.createGroupSession(group);
      }

      // 创建消息
      const message = await Message.createGroupMessage({
        groupId,
        senderId,
        content,
        type,
        fileUrl,
        fileName,
        fileSize
      });

      // 更新聊天会话的最后消息
      await chatSession.updateLastMessage(message);

      // 增加所有成员的未读计数（除了发送者）
      const otherMembers = group.members.filter(member => 
        !member.userId.equals(senderId) && member.isActive
      );

      for (const member of otherMembers) {
        await chatSession.incrementUnreadCount(member.userId);
      }

      // 增加群组消息计数
      await group.incrementMessageCount();

      // 返回消息
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'username avatarUrl')
        .populate('groupId', 'name avatarUrl');

      res.status(201).json({
        success: true,
        message: 'Group message sent successfully',
        data: populatedMessage
      });

      // 通过WebSocket发送实时消息
      if (global.socketServer) {
        await global.socketServer.sendNewMessage(message, chatSession.chatId);
      }

    } catch (error) {
      logger.error('Error sending group message:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // 获取聊天历史
  async getChatHistory(req, res) {
    try {
      const { chatId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.id;

      // 验证参数
      if (!chatId) {
        return res.status(400).json({
          success: false,
          message: 'Chat ID is required'
        });
      }

      // 检查用户是否有权限访问这个聊天
      const chatSession = await ChatSession.findOne({ chatId });
      if (!chatSession) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }

      const isParticipant = chatSession.participants.some(p => p.userId.equals(userId));
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this chat'
        });
      }

      // 计算分页
      const skip = (page - 1) * limit;

      // 获取消息
      const messages = await Message.find({ chatId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('senderId', 'username avatarUrl')
        .populate('receiverId', 'username avatarUrl')
        .populate('groupId', 'name avatarUrl');

      // 获取总数
      const total = await Message.countDocuments({ chatId });

      // 清除未读计数
      await chatSession.clearUnreadCount(userId);

      res.json({
        success: true,
        message: 'Chat history retrieved successfully',
        data: messages.reverse(), // 按时间正序返回
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Error getting chat history:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // 获取聊天会话列表
  async getChatSessions(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;

      // 计算分页
      const skip = (page - 1) * limit;

      // 获取用户的聊天会话
      const chatSessions = await ChatSession.find({
        'participants.userId': userId
      })
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('participants.userId', 'username avatarUrl isOnline lastSeen')
        .populate('lastMessage.senderId', 'username avatarUrl')
        .populate('groupInfo.creator', 'username avatarUrl')
        .populate('groupInfo.admins', 'username avatarUrl');

      // 获取总数
      const total = await ChatSession.countDocuments({
        'participants.userId': userId
      });

      // 格式化返回数据
      const formattedSessions = chatSessions.map(session => {
        const otherParticipant = session.participants.find(p => !p.userId.equals(userId));
        const unreadCount = session.unreadCounts.find(u => u.userId.equals(userId))?.count || 0;

        if (session.type === 'private') {
          return {
            id: session.chatId,
            type: 'private',
            name: otherParticipant?.userId?.username || 'Unknown User',
            avatar_url: otherParticipant?.userId?.avatarUrl,
            participants: session.participants.map(p => ({
              id: p.userId._id,
              username: p.userId.username,
              avatar_url: p.userId.avatarUrl,
              is_online: p.userId.isOnline,
              last_seen: p.userId.lastSeen
            })),
            last_message: session.lastMessage,
            last_activity: session.lastActivity,
            unread_count: unreadCount,
            is_pinned: session.isPinned,
            is_muted: session.isMuted
          };
        } else {
          return {
            id: session.chatId,
            type: 'group',
            name: session.name,
            avatar_url: session.avatarUrl,
            description: session.description,
            participants: session.participants.map(p => ({
              id: p.userId._id,
              username: p.userId.username,
              avatar_url: p.userId.avatarUrl,
              role: p.role
            })),
            group_info: {
              creator: session.groupInfo?.creator,
              admins: session.groupInfo?.admins || []
            },
            last_message: session.lastMessage,
            last_activity: session.lastActivity,
            unread_count: unreadCount,
            is_pinned: session.isPinned,
            is_muted: session.isMuted
          };
        }
      });

      res.json({
        success: true,
        message: 'Chat sessions retrieved successfully',
        data: formattedSessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Error getting chat sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // 标记消息为已读
  async markMessageAsRead(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.id;

      // 验证参数
      if (!messageId) {
        return res.status(400).json({
          success: false,
          message: 'Message ID is required'
        });
      }

      if (!validateObjectId(messageId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid message ID'
        });
      }

      // 查找消息
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      // 检查用户是否有权限标记这条消息
      const chatSession = await ChatSession.findOne({ chatId: message.chatId });
      if (!chatSession) {
        return res.status(404).json({
          success: false,
          message: 'Chat session not found'
        });
      }

      const isParticipant = chatSession.participants.some(p => p.userId.equals(userId));
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this message'
        });
      }

      // 标记为已读
      await message.markAsRead(userId);

      // 清除聊天会话的未读计数
      await chatSession.clearUnreadCount(userId);

      res.json({
        success: true,
        message: 'Message marked as read successfully'
      });

    } catch (error) {
      logger.error('Error marking message as read:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // 删除消息
  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.id;

      // 验证参数
      if (!messageId) {
        return res.status(400).json({
          success: false,
          message: 'Message ID is required'
        });
      }

      if (!validateObjectId(messageId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid message ID'
        });
      }

      // 查找消息
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      // 检查用户是否有权限删除这条消息
      if (!message.senderId.equals(userId)) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own messages'
        });
      }

      // 软删除消息
      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();

      res.json({
        success: true,
        message: 'Message deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting message:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // 获取未读消息计数
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;

      // 获取所有聊天会话的未读计数
      const chatSessions = await ChatSession.find({
        'participants.userId': userId
      });

      const unreadCounts = {};
      let totalUnread = 0;

      for (const session of chatSessions) {
        const unreadCount = session.unreadCounts.find(u => u.userId.equals(userId))?.count || 0;
        unreadCounts[session.chatId] = unreadCount;
        totalUnread += unreadCount;
      }

      res.json({
        success: true,
        message: 'Unread count retrieved successfully',
        data: {
          total: totalUnread,
          byChat: unreadCounts
        }
      });

    } catch (error) {
      logger.error('Error getting unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // 搜索消息
  async searchMessages(req, res) {
    try {
      const { chatId } = req.params;
      const { q: query, page = 1, limit = 20 } = req.query;
      const userId = req.user.id;

      // 验证参数
      if (!chatId || !query) {
        return res.status(400).json({
          success: false,
          message: 'Chat ID and search query are required'
        });
      }

      // 检查用户是否有权限搜索这个聊天
      const chatSession = await ChatSession.findOne({ chatId });
      if (!chatSession) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }

      const isParticipant = chatSession.participants.some(p => p.userId.equals(userId));
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this chat'
        });
      }

      // 计算分页
      const skip = (page - 1) * limit;

      // 搜索消息
      const messages = await Message.find({
        chatId,
        content: { $regex: query, $options: 'i' },
        isDeleted: { $ne: true }
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('senderId', 'username avatarUrl')
        .populate('receiverId', 'username avatarUrl')
        .populate('groupId', 'name avatarUrl');

      // 获取总数
      const total = await Message.countDocuments({
        chatId,
        content: { $regex: query, $options: 'i' },
        isDeleted: { $ne: true }
      });

      res.json({
        success: true,
        message: 'Messages searched successfully',
        data: messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Error searching messages:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export default new MessageController();
