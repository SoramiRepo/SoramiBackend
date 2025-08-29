import Group from '../models/Group.js';
import ChatSession from '../models/ChatSession.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

// Create a new group
const createGroup = async (req, res) => {
  try {
    const { name, description, type, maxMembers, category, tags } = req.body;
    const creatorId = req.user.id;

    // Validate required fields
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Group name and description are required'
      });
    }

    // Check if user already has too many groups
    const userGroups = await Group.countDocuments({ 'members.user': creatorId });
    if (userGroups >= 50) {
      return res.status(400).json({
        success: false,
        message: 'You have reached the maximum number of groups allowed'
      });
    }

    // Create the group
    const group = new Group({
      name,
      description,
      type: type || 'public',
      maxMembers: maxMembers || 1000,
      category,
      tags,
      creator: creatorId,
      admins: [creatorId]
    });

    await group.save();

    // Create chat session for the group
    await ChatSession.createGroupSession(group._id, creatorId, [creatorId]);

    // Populate creator info
    await group.populate('creator', 'username avatar');

    logger.info(`Group "${name}" created by user ${creatorId}`);

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: group
    });
  } catch (error) {
    logger.error('Error creating group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create group',
      error: error.message
    });
  }
};

// Get all groups (with pagination and search)
const getGroups = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, type, category, tags } = req.query;
    const skip = (page - 1) * limit;

    let query = { status: 'active' };

    // Add search filter
    if (search) {
      query.$text = { $search: search };
    }

    // Add type filter
    if (type) {
      query.type = type;
    }

    // Add category filter
    if (category) {
      query.category = category;
    }

    // Add tags filter
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    const groups = await Group.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('creator', 'username avatar')
      .populate('members.user', 'username avatar');

    const total = await Group.countDocuments(query);

    res.json({
      success: true,
      data: groups,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    });
  } catch (error) {
    logger.error('Error getting groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get groups',
      error: error.message
    });
  }
};

// Get group details by ID
const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId)
      .populate('creator', 'username avatar email')
      .populate('members.user', 'username avatar email')
      .populate('admins', 'username avatar');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (group.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Group is not active'
      });
    }

    // Check if user is member
    const isMember = group.isMember(userId);
    const isAdmin = group.isAdmin(userId);
    const isCreator = group.isCreator(userId);

    // Update last seen if user is member
    if (isMember) {
      await group.updateMemberRole(userId, group.members.find(m => m.user._id.toString() === userId).role);
    }

    res.json({
      success: true,
      data: {
        ...group.toObject(),
        userRole: isMember ? (isCreator ? 'creator' : (isAdmin ? 'admin' : 'member')) : null,
        canJoin: !isMember && group.type === 'public',
        canInvite: isMember && (isAdmin || group.settings.allowMemberInvites)
      }
    });
  } catch (error) {
    logger.error('Error getting group details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get group details',
      error: error.message
    });
  }
};

// Update group information
const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check permissions
    if (!group.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update group information'
      });
    }

    // Fields that can be updated
    const allowedFields = ['name', 'description', 'avatar', 'category', 'tags', 'settings'];
    const filteredData = {};
    
    allowedFields.forEach(field => {
      if (updateData.hasOwnProperty(field)) {
        filteredData[field] = updateData[field];
      }
    });

    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      filteredData,
      { new: true, runValidators: true }
    ).populate('creator', 'username avatar');

    logger.info(`Group ${groupId} updated by user ${userId}`);

    res.json({
      success: true,
      message: 'Group updated successfully',
      data: updatedGroup
    });
  } catch (error) {
    logger.error('Error updating group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update group',
      error: error.message
    });
  }
};

// Join a group
const joinGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (group.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Group is not active'
      });
    }

    // Check if user is already a member
    if (group.isMember(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this group'
      });
    }

    // Check if group is full
    if (group.members.length >= group.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Group is full'
      });
    }

    // Check if group allows joining
    if (group.type === 'secret') {
      return res.status(403).json({
        success: false,
        message: 'This group is secret and cannot be joined directly'
      });
    }

    // Add user to group
    await group.addMember(userId, 'member');

    // Update chat session
    await ChatSession.findOneAndUpdate(
      { chatId: `group_${groupId}` },
      { $push: { participants: { user: userId, role: 'member' } } }
    );

    logger.info(`User ${userId} joined group ${groupId}`);

    res.json({
      success: true,
      message: 'Successfully joined the group',
      data: group
    });
  } catch (error) {
    logger.error('Error joining group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join group',
      error: error.message
    });
  }
};

// Leave a group
const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if user is a member
    if (!group.isMember(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Creator cannot leave the group
    if (group.isCreator(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Group creator cannot leave the group'
      });
    }

    // Remove user from group
    await group.removeMember(userId);

    // Update chat session
    await ChatSession.findOneAndUpdate(
      { chatId: `group_${groupId}` },
      { $pull: { participants: { user: userId } } }
    );

    logger.info(`User ${userId} left group ${groupId}`);

    res.json({
      success: true,
      message: 'Successfully left the group'
    });
  } catch (error) {
    logger.error('Error leaving group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave group',
      error: error.message
    });
  }
};

// Add member to group
const addGroupMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId, role = 'member' } = req.body;
    const adminId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if admin has permission
    if (!group.isAdmin(adminId)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can add members'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is already a member
    if (group.isMember(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this group'
      });
    }

    // Add user to group
    await group.addMember(userId, role);

    // Update chat session
    await ChatSession.findOneAndUpdate(
      { chatId: `group_${groupId}` },
      { $push: { participants: { user: userId, role } } }
    );

    logger.info(`User ${userId} added to group ${groupId} by admin ${adminId}`);

    res.json({
      success: true,
      message: 'Member added successfully',
      data: group
    });
  } catch (error) {
    logger.error('Error adding group member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add member',
      error: error.message
    });
  }
};

// Remove member from group
const removeGroupMember = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const adminId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if admin has permission
    if (!group.isAdmin(adminId)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can remove members'
      });
    }

    // Check if user is a member
    if (!group.isMember(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is not a member of this group'
      });
    }

    // Cannot remove creator
    if (group.isCreator(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove group creator'
      });
    }

    // Cannot remove other admins unless you're the creator
    if (group.isAdmin(userId) && !group.isCreator(adminId)) {
      return res.status(403).json({
        success: false,
        message: 'Only group creator can remove admins'
      });
    }

    // Remove user from group
    await group.removeMember(userId);

    // Update chat session
    await ChatSession.findOneAndUpdate(
      { chatId: `group_${groupId}` },
      { $pull: { participants: { user: userId } } }
    );

    logger.info(`User ${userId} removed from group ${groupId} by admin ${adminId}`);

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    logger.error('Error removing group member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member',
      error: error.message
    });
  }
};

// Search groups
const searchGroups = async (req, res) => {
  try {
    const { q, type, category, tags, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const options = { type, category, tags: tags ? tags.split(',') : undefined, limit: parseInt(limit), skip };
    const groups = await Group.searchGroups(q, options);

    res.json({
      success: true,
      data: groups,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(groups.length / limit),
        hasMore: page * limit < groups.length
      }
    });
  } catch (error) {
    logger.error('Error searching groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search groups',
      error: error.message
    });
  }
};

export {
  createGroup,
  getGroups,
  getGroupDetails,
  updateGroup,
  joinGroup,
  leaveGroup,
  addGroupMember,
  removeGroupMember,
  searchGroups
};
