// 前端聊天客户端使用示例
// 需要先安装: npm install socket.io-client

import { io } from 'socket.io-client';

class ChatClient {
    constructor(serverUrl, authToken) {
        this.socket = io(serverUrl, {
            auth: { token: authToken },
            transports: ['websocket', 'polling']
        });
        
        this.setupEventListeners();
        this.isConnected = false;
    }

    setupEventListeners() {
        // 连接成功
        this.socket.on('connected', (data) => {
            console.log('Connected to chat server:', data);
            this.isConnected = true;
            this.userId = data.userId;
            this.username = data.username;
        });

        // 连接错误
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.isConnected = false;
        });

        // 断开连接
        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected:', reason);
            this.isConnected = false;
        });

        // 新消息
        this.socket.on('new_message', (data) => {
            console.log('New message received:', data);
            this.handleNewMessage(data);
        });

        // 消息发送确认
        this.socket.on('message_sent', (data) => {
            console.log('Message sent successfully:', data);
        });

        // 用户正在输入
        this.socket.on('user_typing', (data) => {
            console.log('User typing:', data);
            this.handleUserTyping(data);
        });

        // 用户停止输入
        this.socket.on('user_stopped_typing', (data) => {
            console.log('User stopped typing:', data);
            this.handleUserStoppedTyping(data);
        });

        // 消息已读
        this.socket.on('message_read', (data) => {
            console.log('Message read:', data);
            this.handleMessageRead(data);
        });

        // 用户上线
        this.socket.on('user_online', (data) => {
            console.log('User online:', data);
            this.handleUserOnline(data);
        });

        // 用户下线
        this.socket.on('user_offline', (data) => {
            console.log('User offline:', data);
            this.handleUserOffline(data);
        });

        // 错误处理
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    }

    // 发送消息
    sendMessage(receiverId, content, messageType = 'text') {
        if (!this.isConnected) {
            throw new Error('Not connected to server');
        }

        this.socket.emit('send_message', {
            receiverId,
            content,
            messageType
        });
    }

    // 开始输入提示
    startTyping(receiverId) {
        if (this.isConnected) {
            this.socket.emit('typing_start', { receiverId });
        }
    }

    // 停止输入提示
    stopTyping(receiverId) {
        if (this.isConnected) {
            this.socket.emit('typing_stop', { receiverId });
        }
    }

    // 标记消息为已读
    markMessageAsRead(messageId) {
        if (this.isConnected) {
            this.socket.emit('mark_read', { messageId });
        }
    }

    // 加入聊天房间
    joinChatRoom(otherUserId) {
        if (this.isConnected) {
            this.socket.emit('join_room', { otherUserId });
        }
    }

    // 离开聊天房间
    leaveChatRoom(otherUserId) {
        if (this.isConnected) {
            this.socket.emit('leave_room', { otherUserId });
        }
    }

    // 断开连接
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    // 事件处理器（需要根据具体需求实现）
    handleNewMessage(data) {
        // 处理新消息
        // 例如：更新UI、播放提示音等
    }

    handleUserTyping(data) {
        // 处理用户正在输入
        // 例如：显示"正在输入..."提示
    }

    handleUserStoppedTyping(data) {
        // 处理用户停止输入
        // 例如：隐藏"正在输入..."提示
    }

    handleMessageRead(data) {
        // 处理消息已读
        // 例如：更新消息状态、显示已读标记等
    }

    handleUserOnline(data) {
        // 处理用户上线
        // 例如：更新在线状态、显示绿色圆点等
    }

    handleUserOffline(data) {
        // 处理用户下线
        // 例如：更新在线状态、显示灰色圆点等
    }
}

// 使用示例
const chatClient = new ChatClient('http://localhost:3000', 'your-jwt-token-here');

// 发送消息
chatClient.sendMessage('target-user-id', 'Hello, how are you?');

// 加入聊天房间
chatClient.joinChatRoom('target-user-id');

// 开始输入提示
chatClient.startTyping('target-user-id');

// 停止输入提示
chatClient.stopTyping('target-user-id');

// 标记消息为已读
chatClient.markMessageAsRead('message-id');

// 断开连接
// chatClient.disconnect();
