import { io } from 'socket.io-client';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGE4ODRkZjA2M2QyODRlZmUxOGRkYzQiLCJ1c2VybmFtZSI6ImN5dyIsImlhdCI6MTc1NTkxMDMzNywiZXhwIjoxNzU2NTE1MTM3fQ.0SdEAf4XDkC-eMDL4ndZOIJmBJDdLu_rPQAHO_3FjQ0';

console.log('🔌 Connecting to WebSocket server...');

const socket = io('http://localhost:3000', {
    auth: { token },
    transports: ['websocket', 'polling']
});

// 连接事件
socket.on('connect', () => {
    console.log('✅ Connected to server');
});

socket.on('connected', (data) => {
    console.log('🎉 Authenticated successfully:', data);
});

socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected:', reason);
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
});

// 消息事件
socket.on('message_sent', (data) => {
    console.log('📤 Message sent:', data.message.content);
});

socket.on('new_message', (data) => {
    console.log('📨 New message received:', data.message.content);
});

// 测试发送消息
setTimeout(() => {
    if (socket.connected) {
        console.log('📤 Sending test message...');
        socket.emit('send_message', {
            receiverId: '68a87d6f063d284efe18d36c',
            content: 'Hello from WebSocket!',
            messageType: 'text'
        });
    }
}, 2000);

// 测试输入提示
setTimeout(() => {
    if (socket.connected) {
        console.log('⌨️  Starting typing indicator...');
        socket.emit('typing_start', {
            receiverId: '68a87d6f063d284efe18d36c'
        });
        
        setTimeout(() => {
            console.log('⌨️  Stopping typing indicator...');
            socket.emit('typing_stop', {
                receiverId: '68a87d6f063d284efe18d36c'
            });
        }, 3000);
    }
}, 5000);

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n🔄 Disconnecting...');
    socket.disconnect();
    process.exit(0);
});
