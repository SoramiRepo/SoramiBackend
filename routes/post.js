import express from 'express';
import Post from '../models/Post.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

const getTokenFromHeader = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }
    return null;
};

// Helper: Recursively get replies
async function getAllReplies(postId) {
    const directReplies = await Post.find({ parent: postId })
        .sort({ createdAt: 1 })
        .populate('author', 'username avatarname avatarimg badges')
        .populate('repost')

    const allReplies = [...directReplies];

    for (const reply of directReplies) {
        const subReplies = await getAllReplies(reply._id);
        allReplies.push(...subReplies);
    }

    return allReplies;
}

// Create post
router.post('/create', authMiddleware, async (req, res) => {
    const token = getTokenFromHeader(req);
    const { content } = req.body;

    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const newPost = new Post({ content, author: decoded.userId });
        await newPost.save();

        const populatedPost = await newPost.populate('author', 'username avatarname avatarimg badges')

        res.json({ message: 'Post created successfully', post: populatedPost });

        if (process.env.DEBUG) console.log(`[DEBUG] -> User posted`);
    } catch (err) {
        console.error('Post Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all posts
router.get('/all', async (req, res) => {
    try {
        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .populate('author', 'username avatarname avatarimg badges')
            .populate({
                path: 'repost',
                populate: {
                    path: 'author',
                    select: 'username avatarname avatarimg badges',
                }
            });

        res.json({ posts });
    } catch (err) {
        console.error('Fetch Posts Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


// Delete post
router.delete('/delete/:id', async (req, res) => {
    const token = getTokenFromHeader(req);
    const { id } = req.params;

    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const post = await Post.findById(id);

        if (!post) return res.status(404).json({ message: 'Post does not exist' });
        if (post.author.toString() !== decoded.userId) return res.status(403).json({ message: 'No permission' });

        await Post.findByIdAndDelete(id);
        res.json({ message: 'Post deleted successfully' });

        if (process.env.DEBUG) console.log(`[DEBUG] -> Post deleted by user ${decoded.userId}`);
    } catch (err) {
        console.error('Delete Post Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reply to a post
router.post('/reply/:parentId', authMiddleware, async (req, res) => {
    const token = getTokenFromHeader(req);
    const { content } = req.body;
    const { parentId } = req.params;

    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const parentPost = await Post.findById(parentId);
        if (!parentPost) return res.status(404).json({ message: 'Original post not found' });

        const replyPost = new Post({ content, author: decoded.userId, parent: parentId });
        await replyPost.save();

        const populatedReply = await replyPost.populate('author', 'username avatarname avatarimg badges')

        res.json({ message: 'Reply successful', reply: populatedReply });

        if (process.env.DEBUG) console.log(`[DEBUG] -> User ${decoded.userId} replied to post ${parentId}`);
    } catch (err) {
        console.error('Reply Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Repost Post
router.post('/repost', authMiddleware, async (req, res) => {
    const { repostId } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        if (!mongoose.isValidObjectId(repostId)) {
            return res.status(400).json({ message: 'Invalid repost ID' });
        }

        const originalPost = await Post.findById(repostId)
            .populate('author', 'username avatarname avatarimg badges')
            .populate({
                path: 'repost',
                populate: {
                    path: 'author',
                    select: 'username avatarname avatarimg badges',
                }
            });

        if (!originalPost) {
            return res.status(404).json({ message: 'Original post not found or has been deleted' });
        }

        // Create the repost
        const newPost = new Post({
            author: userId,
            content: '',  // Reposts might not need content
            repost: repostId,
        });

        await newPost.save();

        // Populate repost author data correctly
        const populatedPost = await Post.findById(newPost._id)
            .populate('author', 'username avatarname avatarimg badges')
            .populate({
                path: 'repost',
                populate: {
                    path: 'author',
                    select: 'username avatarname avatarimg badges',
                },
            });

        res.status(201).json({ message: 'Repost successful', post: populatedPost });

    } catch (err) {
        console.error('Repost error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


// Get direct replies
router.get('/:id/replies', async (req, res) => {
    try {
        const replies = await Post.find({ parent: req.params.id })
            .sort({ createdAt: 1 })
            .populate('author', 'username avatarname avatarimg badges')
            .populate('repost')

        res.json({ replies });
    } catch (err) {
        console.error('Fetch Replies Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Fetch posts with filter
router.get('/fetch', async (req, res) => {
    try {
        const { userId, keyword, limit = 20 } = req.query;
        const query = {};

        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            query.author = userId;
        }

        if (keyword) {
            query.content = { $regex: keyword, $options: 'i' };
        }

        const parsedLimit = Math.max(1, parseInt(limit) || 20);

        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .limit(parsedLimit)
            .populate('author', 'username avatarname avatarimg badges')
            .populate('repost')

        const postsWithReplies = await Promise.all(posts.map(async (post) => {
            const replies = await Post.find({ parent: post._id })
                .sort({ createdAt: 1 })
                .populate('author', 'username avatarname avatarimg badges')
                .populate('repost')

            return { ...post.toObject(), replies };
        }));

        res.json({ posts: postsWithReplies });
    } catch (err) {
        console.error('Fetch Posts with Replies Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get a single post and all its nested replies
router.get('/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('author', 'username avatarname avatarimg badges')
            .populate({
                path: 'repost',
                populate: {
                    path: 'author',
                    select: 'username avatarname avatarimg badges',
                }
            })

        if (!post) return res.status(404).json({ message: 'Post does not exist' });

        const replies = await getAllReplies(post._id);

        res.json({ post, replies });
    } catch (err) {
        console.error('Fetch Single Post Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
