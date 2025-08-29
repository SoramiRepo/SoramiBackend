import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // Message type (text, image, file, audio, system)
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'audio', 'system'],
    default: 'text',
    required: true
  },

  // Chat type (private or group)
  chatType: {
    type: String,
    enum: ['private', 'group'],
    required: true
  },

  // Sender information
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // For private messages
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // For group messages
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },

  // Message content
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },

  // File information (for file/image/audio messages)
  fileInfo: {
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String,
    thumbnail: String
  },

  // Message status
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
    default: 'sending'
  },

  // Read by users (for group messages)
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Delivered to users (for group messages)
  deliveredTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Reply to another message
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },

  // Forwarded message info
  forwardedFrom: {
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Message metadata
  metadata: {
    edited: {
      type: Boolean,
      default: false
    },
    editedAt: Date,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
messageSchema.index({ chatType: 1, sender: 1, createdAt: -1 });
messageSchema.index({ chatType: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ chatType: 1, group: 1, createdAt: -1 });
messageSchema.index({ status: 1 });
messageSchema.index({ createdAt: -1 });

// Virtual for chat identifier
messageSchema.virtual('chatId').get(function() {
  return this.chatType === 'private' ? this.receiver : this.group;
});

// Static method to create private message
messageSchema.statics.createPrivateMessage = function(data) {
  return this.create({
    type: data.type,
    chatType: 'private',
    sender: data.sender,
    receiver: data.receiver,
    content: data.content,
    fileInfo: data.fileInfo,
    replyTo: data.replyTo,
    forwardedFrom: data.forwardedFrom
  });
};

// Static method to create group message
messageSchema.statics.createGroupMessage = function(data) {
  return this.create({
    type: data.type,
    chatType: 'group',
    sender: data.sender,
    group: data.group,
    content: data.content,
    fileInfo: data.fileInfo,
    replyTo: data.replyTo,
    forwardedFrom: data.forwardedFrom
  });
};

// Instance method to mark message as read
messageSchema.methods.markAsRead = function(userId) {
  if (this.chatType === 'private') {
    this.status = 'read';
  } else {
    const existingRead = this.readBy.find(read => read.user.toString() === userId.toString());
    if (!existingRead) {
      this.readBy.push({ user: userId });
    }
  }
  return this.save();
};

// Instance method to mark message as delivered
messageSchema.methods.markAsDelivered = function(userId) {
  if (this.chatType === 'private') {
    this.status = 'delivered';
  } else {
    const existingDelivery = this.deliveredTo.find(delivery => delivery.user.toString() === userId.toString());
    if (!existingDelivery) {
      this.deliveredTo.push({ user: userId });
    }
  }
  return this.save();
};

// Instance method to update message status
messageSchema.methods.updateStatus = function(status) {
  this.status = status;
  return this.save();
};

// Instance method to edit message
messageSchema.methods.editMessage = function(newContent) {
  this.content = newContent;
  this.metadata.edited = true;
  this.metadata.editedAt = new Date();
  return this.save();
};

// Instance method to delete message
messageSchema.methods.deleteMessage = function() {
  this.metadata.deleted = true;
  this.metadata.deletedAt = new Date();
  return this.save();
};

// Pre-save middleware to validate chat type specific fields
messageSchema.pre('save', function(next) {
  if (this.chatType === 'private' && !this.receiver) {
    return next(new Error('Private messages must have a receiver'));
  }
  if (this.chatType === 'group' && !this.group) {
    return next(new Error('Group messages must have a group'));
  }
  next();
});

export default mongoose.model('Message', messageSchema);
