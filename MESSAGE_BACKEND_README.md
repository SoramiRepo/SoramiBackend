# SoramiBackend Message 功能说明

## 概述

本文档描述了SoramiBackend中实现的私信功能，包括私信、群组聊天、实时通信等特性。

## 功能特性

### 1. 私信功能
- 用户间一对一私信
- 支持文本、图片、文件等多种消息类型
- 消息状态跟踪（发送中、已发送、已送达、已读）
- 未读消息计数
- 聊天会话管理

### 2. 群组聊天
- 创建和管理群组
- 群组成员管理（添加、移除、角色管理）
- 群组权限控制
- 群组设置和配置

### 3. 实时通信
- WebSocket实时消息推送
- 在线状态管理
- 打字状态提示
- 消息送达确认

## 技术架构

### 数据模型

#### Message 模型
```javascript
{
  type: 'text|image|file|system',        // 消息类型
  chatType: 'private|group',             // 聊天类型
  chatId: String,                        // 聊天ID
  senderId: ObjectId,                    // 发送者ID
  receiverId: ObjectId,                  // 接收者ID（私信）
  groupId: ObjectId,                     // 群组ID（群组消息）
  content: String,                       // 消息内容
  fileUrl: String,                       // 文件URL
  fileName: String,                      // 文件名
  fileSize: Number,                      // 文件大小
  status: 'sending|sent|delivered|read|failed', // 消息状态
  readBy: Array,                         // 已读用户列表
  deliveredTo: Array,                    // 已送达用户列表
  replyTo: ObjectId,                     // 回复的消息ID
  forwardedFrom: ObjectId,               // 转发自的消息ID
  metadata: Mixed                        // 元数据
}
```

#### ChatSession 模型
```javascript
{
  type: 'private|group',                 // 聊天类型
  chatId: String,                        // 聊天ID
  name: String,                          // 聊天名称
  avatarUrl: String,                     // 头像URL
  description: String,                   // 描述
  participants: Array,                   // 参与者列表
  groupInfo: Object,                     // 群组信息
  lastMessage: Object,                   // 最后一条消息
  lastActivity: Date,                    // 最后活动时间
  unreadCounts: Array,                  // 未读计数
  isPinned: Boolean,                     // 是否置顶
  isMuted: Boolean,                      // 是否静音
  isArchived: Boolean,                   // 是否归档
  settings: Object                       // 设置
}
```

#### Group 模型
```javascript
{
  name: String,                          // 群组名称
  description: String,                   // 群组描述
  avatarUrl: String,                     // 头像URL
  coverUrl: String,                      // 封面URL
  creator: ObjectId,                     // 创建者
  admins: Array,                         // 管理员列表
  members: Array,                        // 成员列表
  type: 'public|private|secret',         // 群组类型
  maxMembers: Number,                    // 最大成员数
  inviteCode: String,                    // 邀请码
  inviteLink: String,                    // 邀请链接
  settings: Object,                      // 群组设置
  stats: Object,                         // 统计信息
  tags: Array,                           // 标签
  category: String,                      // 分类
  location: Object,                      // 位置信息
  status: 'active|inactive|suspended|deleted' // 状态
}
```

### WebSocket 事件

#### 客户端到服务器
- `join_chat`: 加入聊天
- `leave_chat`: 离开聊天
- `typing`: 开始打字
- `stop_typing`: 停止打字
- `message_read`: 标记消息已读

#### 服务器到客户端
- `new_message`: 新消息
- `message_status`: 消息状态更新
- `user_typing`: 用户正在打字
- `user_stopped_typing`: 用户停止打字
- `user_online`: 用户上线
- `user_offline`: 用户下线
- `message_read`: 消息已读
- `joined_chat`: 已加入聊天
- `left_chat`: 已离开聊天

## API 接口

### 消息相关

#### 发送私信
```
POST /api/message/private
Content-Type: application/json
Authorization: Bearer <token>

{
  "receiverId": "user_id",
  "content": "消息内容",
  "type": "text",
  "fileUrl": "文件URL",
  "fileName": "文件名",
  "fileSize": 1024
}
```

#### 发送群组消息
```
POST /api/message/group
Content-Type: application/json
Authorization: Bearer <token>

{
  "groupId": "group_id",
  "content": "消息内容",
  "type": "text",
  "fileUrl": "文件URL",
  "fileName": "文件名",
  "fileSize": 1024
}
```

#### 获取聊天历史
```
GET /api/message/chat/:chatId/history?page=1&limit=50
Authorization: Bearer <token>
```

#### 获取聊天会话列表
```
GET /api/message/sessions?page=1&limit=20
Authorization: Bearer <token>
```

#### 标记消息已读
```
PUT /api/message/:messageId/read
Authorization: Bearer <token>
```

#### 删除消息
```
DELETE /api/message/:messageId
Authorization: Bearer <token>
```

#### 获取未读消息计数
```
GET /api/message/unread
Authorization: Bearer <token>
```

#### 搜索消息
```
GET /api/message/chat/:chatId/search?q=关键词&page=1&limit=20
Authorization: Bearer <token>
```

### 群组相关

#### 创建群组
```
POST /api/message/groups
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "群组名称",
  "description": "群组描述",
  "avatarUrl": "头像URL",
  "memberIds": ["user_id1", "user_id2"]
}
```

#### 获取群组列表
```
GET /api/message/groups?page=1&limit=20&type=public&category=技术
Authorization: Bearer <token>
```

#### 获取群组详情
```
GET /api/message/groups/:groupId
Authorization: Bearer <token>
```

#### 更新群组信息
```
PUT /api/message/groups/:groupId
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "新群组名称",
  "description": "新描述",
  "avatarUrl": "新头像URL",
  "settings": {
    "allowMemberInvite": true,
    "allowMemberMessage": true
  }
}
```

#### 加入群组
```
POST /api/message/groups/:groupId/join
Authorization: Bearer <token>
```

#### 离开群组
```
POST /api/message/groups/:groupId/leave
Authorization: Bearer <token>
```

#### 添加群组成员
```
POST /api/message/groups/:groupId/members/:memberId
Authorization: Bearer <token>
```

#### 移除群组成员
```
DELETE /api/message/groups/:groupId/members/:memberId
Authorization: Bearer <token>
```

#### 搜索群组
```
GET /api/message/groups/search?q=关键词&type=public&category=技术&page=1&limit=20
Authorization: Bearer <token>
```

## 权限控制

### 私信权限
- 用户只能与自己参与的聊天会话交互
- 不能给自己发送消息
- 只能删除自己发送的消息

### 群组权限
- **成员**: 发送消息、查看成员
- **管理员**: 管理成员、编辑群组信息
- **创建者**: 所有权限、转让群组

### 消息权限
- 只能访问自己参与的聊天
- 只能标记自己收到的消息为已读
- 只能删除自己发送的消息

## 性能优化

### 数据库索引
- 聊天ID索引
- 发送者ID索引
- 接收者ID索引
- 群组ID索引
- 时间戳索引
- 文本搜索索引

### 分页查询
- 支持分页获取消息和会话
- 默认每页限制数量
- 可配置的最大限制

### 缓存策略
- 聊天会话缓存
- 用户在线状态缓存
- 未读消息计数缓存

## 安全特性

### 身份验证
- JWT Token验证
- WebSocket连接验证
- 用户权限检查

### 输入验证
- 参数类型检查
- 内容长度限制
- 文件类型和大小验证
- SQL注入防护

### 速率限制
- API请求频率限制
- WebSocket连接限制
- 消息发送频率限制

## 部署配置

### 环境变量
```bash
# 数据库配置
MONGO_URI=mongodb://localhost:27017/soramidev

# JWT配置
JWT_SECRET=your_jwt_secret_here

# 前端URL（CORS）
FRONTEND_URL=http://localhost:3000

# 服务器端口
PORT=3000
```

### 依赖包
```json
{
  "socket.io": "^4.7.0",
  "protobufjs": "^7.2.0"
}
```

## 监控和日志

### 日志记录
- 用户连接/断开连接
- 消息发送/接收
- 错误和异常
- 性能指标

### 统计信息
- 在线用户数量
- 活跃聊天数量
- 消息吞吐量
- 错误率

## 故障排除

### 常见问题

#### WebSocket连接失败
- 检查JWT Token是否有效
- 确认CORS配置正确
- 检查网络连接

#### 消息发送失败
- 验证接收者是否存在
- 检查用户权限
- 确认聊天会话有效

#### 群组操作失败
- 验证用户是否是群组成员
- 检查用户权限级别
- 确认群组状态正常

### 调试模式
```bash
DEBUG=true npm start
```

## 扩展功能

### 未来计划
- 消息加密
- 语音/视频通话
- 消息撤回
- 消息转发
- 表情包支持
- 消息搜索优化
- 离线消息推送

### 自定义扩展
- 消息插件系统
- 自定义消息类型
- 第三方集成
- 消息模板

## 许可证

本项目采用 MIT 许可证。
