import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  // Group name
  name: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true
  },

  // Group description
  description: {
    type: String,
    maxlength: 500,
    trim: true
  },

  // Group avatar/icon
  avatar: {
    type: String,
    default: null
  },

  // Group creator
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Group administrators
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Group members
  members: [{
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

  // Group type
  type: {
    type: String,
    enum: ['public', 'private', 'secret'],
    default: 'public'
  },

  // Maximum number of members
  maxMembers: {
    type: Number,
    default: 1000,
    min: 2,
    max: 10000
  },

  // Invite code for private groups
  inviteCode: {
    type: String,
    unique: true,
    sparse: true
  },

  // Invite link
  inviteLink: {
    type: String,
    unique: true,
    sparse: true
  },

  // Group settings
  settings: {
    allowMemberInvites: {
      type: Boolean,
      default: true
    },
    requireAdminApproval: {
      type: Boolean,
      default: false
    },
    allowMemberEditing: {
      type: Boolean,
      default: false
    },
    slowMode: {
      type: Boolean,
      default: false
    },
    slowModeInterval: {
      type: Number,
      default: 0 // seconds
    }
  },

  // Group statistics
  stats: {
    messageCount: {
      type: Number,
      default: 0
    },
    memberCount: {
      type: Number,
      default: 0
    },
    activeMembers: {
      type: Number,
      default: 0
    }
  },

  // Group tags for categorization
  tags: [{
    type: String,
    maxlength: 50
  }],

  // Group category
  category: {
    type: String,
    maxlength: 100
  },

  // Group location (if applicable)
  location: {
    country: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },

  // Group status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'deleted'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
groupSchema.index({ name: 'text', description: 'text' });
groupSchema.index({ creator: 1 });
groupSchema.index({ 'members.user': 1 });
groupSchema.index({ type: 1, status: 1 });
groupSchema.index({ category: 1 });
groupSchema.index({ tags: 1 });
groupSchema.index({ inviteCode: 1 });
groupSchema.index({ inviteLink: 1 });

// Virtual for member count
groupSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for admin count
groupSchema.virtual('adminCount').get(function() {
  return this.admins.length + 1; // +1 for creator
});

// Virtual for is public
groupSchema.virtual('isPublic').get(function() {
  return this.type === 'public';
});

// Virtual for is private
groupSchema.virtual('isPrivate').get(function() {
  return this.type === 'private';
});

// Pre-save middleware
groupSchema.pre('save', function(next) {
  // Generate invite code if not exists
  if (!this.inviteCode) {
    this.inviteCode = this.generateInviteCode();
  }
  
  // Generate invite link if not exists
  if (!this.inviteLink) {
    this.inviteLink = this.generateInviteLink();
  }
  
  // Update stats
  this.stats.memberCount = this.members.length;
  
  // Ensure creator is in members list
  const creatorInMembers = this.members.find(
    m => m.user.toString() === this.creator.toString()
  );
  if (!creatorInMembers) {
    this.members.push({
      user: this.creator,
      role: 'creator',
      joinedAt: new Date()
    });
  }
  
  // Ensure creator is admin
  if (!this.admins.includes(this.creator)) {
    this.admins.push(this.creator);
  }
  
  next();
});

// Static method to search groups
groupSchema.statics.searchGroups = function(query, options = {}) {
  const { type, category, tags, limit = 20, skip = 0 } = options;
  
  let searchQuery = {
    status: 'active',
    $text: { $search: query }
  };
  
  if (type) searchQuery.type = type;
  if (category) searchQuery.category = category;
  if (tags && tags.length > 0) searchQuery.tags = { $in: tags };
  
  return this.find(searchQuery)
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .skip(skip)
    .populate('creator', 'username avatar')
    .populate('members.user', 'username avatar');
};

// Static method to get user's groups
groupSchema.statics.getUserGroups = function(userId) {
  return this.find({
    'members.user': userId,
    status: 'active'
  })
  .populate('creator', 'username avatar')
  .populate('members.user', 'username avatar')
  .sort({ updatedAt: -1 });
};

// Instance method to add member
groupSchema.methods.addMember = function(userId, role = 'member') {
  if (this.members.length >= this.maxMembers) {
    throw new Error('Group is full');
  }
  
  const existingMember = this.members.find(
    m => m.user.toString() === userId.toString()
  );
  
  if (!existingMember) {
    this.members.push({
      user: userId,
      role,
      joinedAt: new Date()
    });
    
    if (role === 'admin') {
      this.admins.push(userId);
    }
  }
  
  return this.save();
};

// Instance method to remove member
groupSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(
    m => m.user.toString() !== userId.toString()
  );
  
  this.admins = this.admins.filter(
    admin => admin.toString() !== userId.toString()
  );
  
  return this.save();
};

// Instance method to update member role
groupSchema.methods.updateMemberRole = function(userId, newRole) {
  const member = this.members.find(
    m => m.user.toString() === userId.toString()
  );
  
  if (member) {
    member.role = newRole;
    
    if (newRole === 'admin') {
      if (!this.admins.includes(userId)) {
        this.admins.push(userId);
      }
    } else {
      this.admins = this.admins.filter(
        admin => admin.toString() !== userId.toString()
      );
    }
  }
  
  return this.save();
};

// Instance method to generate invite code
groupSchema.methods.generateInviteCode = function() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Instance method to generate invite link
groupSchema.methods.generateInviteLink = function() {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/group/join/${this.inviteCode}`;
};

// Instance method to check if user is member
groupSchema.methods.isMember = function(userId) {
  return this.members.some(
    m => m.user.toString() === userId.toString()
  );
};

// Instance method to check if user is admin
groupSchema.methods.isAdmin = function(userId) {
  return this.admins.includes(userId) || this.creator.toString() === userId.toString();
};

// Instance method to check if user is creator
groupSchema.methods.isCreator = function(userId) {
  return this.creator.toString() === userId.toString();
};

// Instance method to increment message count
groupSchema.methods.incrementMessageCount = function() {
  this.stats.messageCount += 1;
  return this.save();
};

export default mongoose.model('Group', groupSchema);
