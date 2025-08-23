# 聊天系统API文档

## 概述
这是一个完整的WebSocket一对一聊天系统，支持实时消息传递、在线状态、输入提示等功能。

## 功能特性
- ✅ 实时一对一聊天
- ✅ 消息持久化存储
- ✅ 在线/离线状态
- ✅ 输入提示（正在输入...）
- ✅ 消息已读状态
- ✅ 未读消息计数
- ✅ 聊天会话管理
- ✅ 消息软删除
- ✅ 分页加载聊天记录

## REST API 端点

### 1. 发送消息
```
POST /api/message/send
Authorization: Bearer {token}
Content-Type: application/json

{
    "receiverId": "user_id_here",
    "content": "Hello, how are you?",
    "messageType": "text"  // 可选: text, image, file
}
```

### 2. 获取聊天记录
```
GET /api/message/chat/:targetUserId?page=1&limit=50
Authorization: Bearer {token}
```

### 3. 获取聊天会话列表
```
GET /api/message/sessions?page=1&limit=20
Authorization: Bearer {token}
```

### 4. 删除消息
```
DELETE /api/message/:messageId
Authorization: Bearer {token}
```

### 5. 标记消息为已读
```
PUT /api/message/:messageId/read
Authorization: Bearer {token}
```

### 6. 获取未读消息数
```
GET /api/message/unread/count
Authorization: Bearer {token}
```

## WebSocket 事件

### 客户端发送事件

#### 发送消息
```javascript
socket.emit('send_message', {
    receiverId: 'user_id',
    content: 'Hello!',
    messageType: 'text'
});
```

#### 开始输入提示
```javascript
socket.emit('typing_start', {
    receiverId: 'user_id'
});
```

#### 停止输入提示
```javascript
socket.emit('typing_stop', {
    receiverId: 'user_id'
});
```

#### 标记消息为已读
```javascript
socket.emit('mark_read', {
    messageId: 'message_id'
});
```

#### 加入聊天房间
```javascript
socket.emit('join_room', {
    otherUserId: 'user_id'
});
```

#### 离开聊天房间
```javascript
socket.emit('leave_room', {
    otherUserId: 'user_id'
});
```

### 客户端接收事件

#### 连接成功
```javascript
socket.on('connected', (data) => {
    console.log('Connected:', data);
    // data: { userId, username, message }
});
```

#### 新消息
```javascript
socket.on('new_message', (data) => {
    console.log('New message:', data);
    // data: { message, sessionId, sender }
});
```

#### 消息发送确认
```javascript
socket.on('message_sent', (data) => {
    console.log('Message sent:', data);
    // data: { message, sessionId }
});
```

#### 用户正在输入
```javascript
socket.on('user_typing', (data) => {
    console.log('User typing:', data);
    // data: { userId, username }
});
```

#### 用户停止输入
```javascript
socket.on('user_stopped_typing', (data) => {
    console.log('User stopped typing:', data);
    // data: { userId, username }
});
```

#### 消息已读
```javascript
socket.on('message_read', (data) => {
    console.log('Message read:', data);
    // data: { messageId, readBy, readAt }
});
```

#### 用户上线
```javascript
socket.on('user_online', (data) => {
    console.log('User online:', data);
    // data: { userId, username, timestamp }
});
```

#### 用户下线
```javascript
socket.on('user_offline', (data) => {
    console.log('User offline:', data);
    // data: { userId, username, timestamp }
});
```

#### 房间加入/离开
```javascript
socket.on('room_joined', (data) => {
    console.log('Joined room:', data);
    // data: { roomName, otherUserId }
});

socket.on('room_left', (data) => {
    console.log('Left room:', data);
    // data: { roomName, otherUserId }
});
```

## 数据模型

### Message 模型
```javascript
{
    _id: ObjectId,
    sender: ObjectId,        // 发送者ID
    receiver: ObjectId,      // 接收者ID
    content: String,         // 消息内容
    messageType: String,     // 消息类型: text, image, file
    isRead: Boolean,         // 是否已读
    readAt: Date,           // 已读时间
    deletedFor: [ObjectId], // 对哪些用户已删除
    createdAt: Date,        // 创建时间
    updatedAt: Date         // 更新时间
}
```

### ChatSession 模型
```javascript
{
    _id: ObjectId,
    participants: [ObjectId],    // 参与者ID数组
    lastMessage: ObjectId,       // 最后一条消息ID
    lastMessageAt: Date,         // 最后消息时间
    unreadCount: Map,            // 未读消息数映射
    isActive: Boolean,           // 会话是否活跃
    userSettings: Map,           // 用户设置映射
    createdAt: Date,             // 创建时间
    updatedAt: Date              // 更新时间
}
```

## 使用流程

### 1. 建立连接
```javascript
const socket = io('http://localhost:3000', {
    auth: { token: 'your-jwt-token' }
});
```

### 2. 监听连接事件
```javascript
socket.on('connected', (data) => {
    // 连接成功后的处理
});
```

### 3. 发送消息
```javascript
socket.emit('send_message', {
    receiverId: 'target_user_id',
    content: 'Hello!'
});
```

### 4. 接收消息
```javascript
socket.on('new_message', (data) => {
    // 处理新消息
    console.log('收到新消息:', data.message.content);
});
```

### 5. 加入聊天房间
```javascript
socket.emit('join_room', {
    otherUserId: 'target_user_id'
});
```

## 错误处理

### 连接错误
```javascript
socket.on('connect_error', (error) => {
    console.error('连接失败:', error.message);
    // 处理连接错误，如重新连接
});
```

### 认证错误
```javascript
socket.on('error', (error) => {
    if (error.message.includes('Authentication')) {
        // 处理认证错误，如重新登录
        console.error('认证失败:', error.message);
    }
});
```

## 安全特性

- JWT认证保护所有API端点
- WebSocket连接需要有效token
- 用户只能访问自己的聊天记录
- 消息软删除，保护数据完整性
- 输入验证和清理

## 性能优化

- 消息分页加载
- 数据库索引优化
- WebSocket房间管理
- 连接池管理
- 消息缓存

## 部署说明

1. 确保安装了所有依赖：`npm install`
2. 设置环境变量：`JWT_SECRET`
3. 启动服务器：`npm start`
4. WebSocket服务器会自动在HTTP服务器上启动
5. 前端需要安装：`npm install socket.io-client`
