import mongoose from 'mongoose';

const chatSessionSchema = new mongoose.Schema({
  // Chat type (private or group)
  chatType: {
    type: String,
    enum: ['private', 'group'],
    required: true
  },

  // For private chats: unique identifier combining both users
  // For group chats: group ID
  chatId: {
    type: String,
    required: true,
    unique: true
  },

  // Chat name (for group chats or display name for private chats)
  name: {
    type: String,
    required: true,
    maxlength: 100
  },

  // Chat avatar/icon
  avatar: {
    type: String,
    default: null
  },

  // Chat description (for group chats)
  description: {
    type: String,
    maxlength: 500
  },

  // Participants in the chat
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['member', 'admin', 'creator'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  }],

  // Group-specific information
  groupInfo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },

  // Last message in the chat
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },

  // Last activity timestamp
  lastActivity: {
    type: Date,
    default: Date.now
  },

  // Unread message counts for each participant
  unreadCounts: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    count: {
      type: Number,
      default: 0
    }
  }],

  // Chat settings
  settings: {
    pinned: {
      type: Boolean,
      default: false
    },
    muted: {
      type: Boolean,
      default: false
    },
    archived: {
      type: Boolean,
      default: false
    },
    notifications: {
      type: Boolean,
      default: true
    }
  },

  // Chat metadata
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
chatSessionSchema.index({ chatType: 1, participants: 1 });
chatSessionSchema.index({ lastActivity: -1 });
chatSessionSchema.index({ 'participants.user': 1 });
chatSessionSchema.index({ chatId: 1 }, { unique: true });

// Virtual for participant count
chatSessionSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Virtual for is group chat
chatSessionSchema.virtual('isGroupChat').get(function() {
  return this.chatType === 'group';
});

// Static method to create private chat session
chatSessionSchema.statics.createPrivateSession = function(user1Id, user2Id) {
  const chatId = [user1Id, user2Id].sort().join('_');
  
  return this.findOneAndUpdate(
    { chatId },
    {
      chatType: 'private',
      chatId,
      name: 'Private Chat',
      participants: [
        { user: user1Id, role: 'member' },
        { user: user2Id, role: 'member' }
      ],
      metadata: { createdBy: user1Id }
    },
    { upsert: true, new: true }
  );
};

// Static method to create group chat session
chatSessionSchema.statics.createGroupSession = function(groupId, creatorId, participants) {
  const chatId = `group_${groupId}`;
  
  return this.findOneAndUpdate(
    { chatId },
    {
      chatType: 'group',
      chatId,
      groupInfo: groupId,
      participants: participants.map(userId => ({
        user: userId,
        role: userId === creatorId ? 'creator' : 'member'
      })),
      metadata: { createdBy: creatorId }
    },
    { upsert: true, new: true }
  );
};

// Instance method to add participant
chatSessionSchema.methods.addParticipant = function(userId, role = 'member') {
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (!existingParticipant) {
    this.participants.push({
      user: userId,
      role,
      joinedAt: new Date()
    });
    this.unreadCounts.push({ user: userId, count: 0 });
  }
  
  return this.save();
};

// Instance method to remove participant
chatSessionSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(
    p => p.user.toString() !== userId.toString()
  );
  this.unreadCounts = this.unreadCounts.filter(
    u => u.user.toString() !== userId.toString()
  );
  
  return this.save();
};

// Instance method to update participant role
chatSessionSchema.methods.updateParticipantRole = function(userId, newRole) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (participant) {
    participant.role = newRole;
  }
  
  return this.save();
};

// Instance method to update last message
chatSessionSchema.methods.updateLastMessage = function(messageId) {
  this.lastMessage = messageId;
  this.lastActivity = new Date();
  return this.save();
};

// Instance method to increment unread count
chatSessionSchema.methods.incrementUnreadCount = function(userId) {
  const unreadCount = this.unreadCounts.find(
    u => u.user.toString() === userId.toString()
  );
  
  if (unreadCount) {
    unreadCount.count += 1;
  } else {
    this.unreadCounts.push({ user: userId, count: 1 });
  }
  
  return this.save();
};

// Instance method to reset unread count
chatSessionSchema.methods.resetUnreadCount = function(userId) {
  const unreadCount = this.unreadCounts.find(
    u => u.user.toString() === userId.toString()
  );
  
  if (unreadCount) {
    unreadCount.count = 0;
  }
  
  return this.save();
};

// Instance method to update participant last seen
chatSessionSchema.methods.updateLastSeen = function(userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (participant) {
    participant.lastSeen = new Date();
  }
  
  return this.save();
};

// Instance method to toggle chat setting
chatSessionSchema.methods.toggleSetting = function(setting) {
  if (this.settings.hasOwnProperty(setting)) {
    this.settings[setting] = !this.settings[setting];
  }
  return this.save();
};

// Pre-save middleware to update metadata
chatSessionSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  next();
});

export default mongoose.model('ChatSession', chatSessionSchema);
