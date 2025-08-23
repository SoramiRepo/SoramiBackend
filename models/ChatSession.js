import mongoose from 'mongoose';

const chatSessionSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    unreadCount: {
        type: Map,
        of: Number,
        default: new Map()
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // 用户特定的设置
    userSettings: {
        type: Map,
        of: {
            muted: { type: Boolean, default: false },
            blocked: { type: Boolean, default: false },
            lastSeen: { type: Date, default: Date.now }
        }
    }
}, {
    timestamps: true
});

// 确保参与者是唯一的
chatSessionSchema.index({ participants: 1 }, { unique: true });

// 虚拟字段：获取会话名称（用于显示）
chatSessionSchema.virtual('sessionName').get(function() {
    // 这里可以根据需要实现会话名称逻辑
    return `Chat Session`;
});

// 方法：获取用户未读消息数
chatSessionSchema.methods.getUnreadCount = function(userId) {
    return this.unreadCount.get(userId.toString()) || 0;
};

// 方法：增加未读消息数
chatSessionSchema.methods.incrementUnreadCount = function(userId) {
    const currentCount = this.getUnreadCount(userId);
    this.unreadCount.set(userId.toString(), currentCount + 1);
    return this.save();
};

// 方法：重置未读消息数
chatSessionSchema.methods.resetUnreadCount = function(userId) {
    this.unreadCount.set(userId.toString(), 0);
    return this.save();
};

// 静态方法：查找或创建会话
chatSessionSchema.statics.findOrCreateSession = async function(user1Id, user2Id) {
    const participants = [user1Id, user2Id].sort();
    
    let session = await this.findOne({ participants });
    
    if (!session) {
        session = new this({
            participants,
            unreadCount: new Map([
                [user1Id.toString(), 0],
                [user2Id.toString(), 0]
            ]),
            userSettings: new Map([
                [user1Id.toString(), { muted: false, blocked: false, lastSeen: new Date() }],
                [user2Id.toString(), { muted: false, blocked: false, lastSeen: new Date() }]
            ])
        });
        await session.save();
    }
    
    return session;
};

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
export default ChatSession;
