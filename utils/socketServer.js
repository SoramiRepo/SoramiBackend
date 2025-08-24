import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from './logger.js';
import Message from '../models/Message.js';
import ChatSession from '../models/ChatSession.js';
import User from '../models/User.js';

class SocketServer {
    constructor(server) {
        this.io = new Server(server, {
            cors: {
                origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
                credentials: true
            }
        });
        
        this.userSockets = new Map(); // userId -> socket
        this.socketUsers = new Map(); // socket -> userId
        
        this.setupMiddleware();
        this.setupEventHandlers();
    }

    setupMiddleware() {
        // 认证中间件
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
                
                if (!token) {
                    return next(new Error('Authentication error: No token provided'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.userId = decoded.userId;
                socket.username = decoded.username;
                next();
            } catch (error) {
                next(new Error('Authentication error: Invalid token'));
            }
        });
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            logger.websocket(`User connected: ${socket.username}`, socket.userId);
            
            this.handleConnection(socket);
            
            socket.on('disconnect', () => {
                this.handleDisconnection(socket);
            });

            socket.on('send_message', async (data) => {
                await this.handleSendMessage(socket, data);
            });

            socket.on('typing_start', (data) => {
                this.handleTypingStart(socket, data);
            });

            socket.on('typing_stop', (data) => {
                this.handleTypingStop(socket, data);
            });

            socket.on('mark_read', async (data) => {
                await this.handleMarkRead(socket, data);
            });

            socket.on('join_room', (data) => {
                this.handleJoinRoom(socket, data);
            });

            socket.on('leave_room', (data) => {
                this.handleLeaveRoom(socket, data);
            });
        });
    }

    handleConnection(socket) {
        const userId = socket.userId;
        
        // 存储用户socket映射
        this.userSockets.set(userId, socket);
        this.socketUsers.set(socket, userId);
        
        // 加入用户专属房间
        socket.join(`user_${userId}`);
        
        // 发送连接成功消息
        socket.emit('connected', {
            userId,
            username: socket.username,
            message: 'Successfully connected to chat server'
        });
        
        // 广播用户上线状态
        socket.broadcast.emit('user_online', {
            userId,
            username: socket.username,
            timestamp: new Date()
        });
    }

    handleDisconnection(socket) {
        const userId = socket.userId;
        
        logger.websocket(`User disconnected: ${socket.username}`, userId);
        
        // 清理映射
        this.userSockets.delete(userId);
        this.socketUsers.delete(socket);
        
        // 广播用户下线状态
        socket.broadcast.emit('user_offline', {
            userId,
            username: socket.username,
            timestamp: new Date()
        });
    }

    async handleSendMessage(socket, data) {
        try {
            const { receiverId, content, messageType = 'text' } = data;
            const senderId = socket.userId;
            
            // 验证输入参数
            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                socket.emit('error', { message: 'Valid message content is required' });
                return;
            }
            
            if (content.length > 1000) {
                socket.emit('error', { message: 'Message content too long (max 1000 characters)' });
                return;
            }
            
            if (!receiverId || typeof receiverId !== 'string') {
                socket.emit('error', { message: 'Valid receiver ID is required' });
                return;
            }
            
            if (!['text', 'image', 'file'].includes(messageType)) {
                socket.emit('error', { message: 'Invalid message type' });
                return;
            }
            
            // 验证接收者
            const receiver = await User.findById(receiverId);
            if (!receiver) {
                socket.emit('error', { message: 'Receiver not found' });
                return;
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
            
            // 填充发送者信息
            await message.populate('sender', 'username avatarname avatarimg');
            await message.populate('receiver', 'username avatarname avatarimg');

            // 更新会话信息
            session.lastMessage = message._id;
            session.lastMessageAt = new Date();
            await session.incrementUnreadCount(receiverId);
            await session.save();

            // 发送给发送者（确认）
            socket.emit('message_sent', {
                message,
                sessionId: session._id
            });

            // 发送给接收者
            const receiverSocket = this.userSockets.get(receiverId);
            if (receiverSocket) {
                receiverSocket.emit('new_message', {
                    message,
                    sessionId: session._id,
                    sender: {
                        _id: senderId,
                        username: socket.username
                    }
                });
            }

            // 发送给聊天房间的所有成员
            const roomName = this.getChatRoomName(senderId, receiverId);
            socket.to(roomName).emit('message_received', {
                message,
                sessionId: session._id
            });

        } catch (error) {
            console.error('Send message error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    }

    handleTypingStart(socket, data) {
        const { receiverId } = data;
        const roomName = this.getChatRoomName(socket.userId, receiverId);
        
        socket.to(roomName).emit('user_typing', {
            userId: socket.userId,
            username: socket.username
        });
    }

    handleTypingStop(socket, data) {
        const { receiverId } = data;
        const roomName = this.getChatRoomName(socket.userId, receiverId);
        
        socket.to(roomName).emit('user_stopped_typing', {
            userId: socket.userId,
            username: socket.username
        });
    }

    async handleMarkRead(socket, data) {
        try {
            const { messageId } = data;
            const userId = socket.userId;
            
            const message = await Message.findById(messageId);
            if (!message || message.receiver.toString() !== userId) {
                return;
            }

            message.isRead = true;
            message.readAt = new Date();
            await message.save();

            // 通知发送者消息已读
            const senderSocket = this.userSockets.get(message.sender);
            if (senderSocket) {
                senderSocket.emit('message_read', {
                    messageId,
                    readBy: userId,
                    readAt: message.readAt
                });
            }

        } catch (error) {
            console.error('Mark read error:', error);
        }
    }

    handleJoinRoom(socket, data) {
        const { otherUserId } = data;
        const roomName = this.getChatRoomName(socket.userId, otherUserId);
        
        socket.join(roomName);
        socket.emit('room_joined', { roomName, otherUserId });
    }

    handleLeaveRoom(socket, data) {
        const { otherUserId } = data;
        const roomName = this.getChatRoomName(socket.userId, otherUserId);
        
        socket.leave(roomName);
        socket.emit('room_left', { roomName, otherUserId });
    }

    getChatRoomName(user1Id, user2Id) {
        // 确保房间名称一致（排序）
        const sortedIds = [user1Id, user2Id].sort();
        return `chat_${sortedIds[0]}_${sortedIds[1]}`;
    }

    // 发送消息给特定用户
    sendToUser(userId, event, data) {
        const socket = this.userSockets.get(userId);
        if (socket) {
            socket.emit(event, data);
        }
    }

    // 广播给所有用户
    broadcastToAll(event, data, excludeUserId = null) {
        this.io.emit(event, data);
    }

    // 获取在线用户列表
    getOnlineUsers() {
        return Array.from(this.userSockets.keys());
    }

    // 检查用户是否在线
    isUserOnline(userId) {
        return this.userSockets.has(userId);
    }
}

export default SocketServer;
