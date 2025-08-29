import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from './logger.js';

class SocketServer {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });
    
    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // userId -> socket instance
    
    this.setupMiddleware();
    this.setupEventHandlers();
    
    logger.info('Socket.IO server initialized');
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.username = decoded.username;
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error.message);
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`User ${socket.username} (${socket.userId}) connected`);
      
      // Store user connection
      this.connectedUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.userId, socket);
      
      // Broadcast user online status
      this.broadcastUserStatus(socket.userId, true);
      
      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`User ${socket.username} (${socket.userId}) disconnected`);
        this.connectedUsers.delete(socket.userId);
        this.userSockets.delete(socket.userId);
        this.broadcastUserStatus(socket.userId, false);
      });

      // Join chat room
      socket.on('join_chat', (data) => {
        const { chatId, chatType } = data;
        const roomName = `${chatType}_${chatId}`;
        socket.join(roomName);
        logger.info(`User ${socket.username} joined ${roomName}`);
      });

      // Leave chat room
      socket.on('leave_chat', (data) => {
        const { chatId, chatType } = data;
        const roomName = `${chatType}_${chatId}`;
        socket.leave(roomName);
        logger.info(`User ${socket.username} left ${roomName}`);
      });

      // Typing indicators
      socket.on('typing_start', (data) => {
        const { chatId, chatType } = data;
        const roomName = `${chatType}_${chatId}`;
        socket.to(roomName).emit('user_typing', {
          userId: socket.userId,
          username: socket.username,
          chatId,
          chatType
        });
      });

      socket.on('typing_stop', (data) => {
        const { chatId, chatType } = data;
        const roomName = `${chatType}_${chatId}`;
        socket.to(roomName).emit('user_stopped_typing', {
          userId: socket.userId,
          username: socket.username,
          chatId,
          chatType
        });
      });

      // Message read status
      socket.on('mark_read', (data) => {
        const { messageId, chatId, chatType } = data;
        const roomName = `${chatType}_${chatId}`;
        socket.to(roomName).emit('message_read', {
          messageId,
          userId: socket.userId,
          username: socket.username,
          chatId,
          chatType
        });
      });
    });
  }

  // Send new message to chat room
  sendNewMessage(chatId, chatType, message) {
    const roomName = `${chatType}_${chatId}`;
    this.io.to(roomName).emit('new_message', message);
    logger.info(`Message sent to ${roomName}`);
  }

  // Update message delivery status
  updateMessageDeliveryStatus(messageId, status, chatId, chatType) {
    const roomName = `${chatType}_${chatId}`;
    this.io.to(roomName).emit('message_status', {
      messageId,
      status,
      timestamp: new Date()
    });
  }

  // Broadcast user online/offline status
  broadcastUserStatus(userId, isOnline) {
    this.io.emit('user_status', {
      userId,
      isOnline,
      timestamp: new Date()
    });
  }

  // Send notification to specific user
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // Send to multiple users
  sendToUsers(userIds, event, data) {
    userIds.forEach(userId => {
      this.sendToUser(userId, event, data);
    });
  }

  // Broadcast to all connected users
  broadcastToAll(event, data) {
    this.io.emit(event, data);
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  // Get user's socket
  getUserSocket(userId) {
    return this.userSockets.get(userId);
  }
}

export default SocketServer;
