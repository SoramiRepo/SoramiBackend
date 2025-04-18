import express from 'express';
import Post from '../models/Post.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const router = express.Router();

// Secure way to get the token
const getTokenFromHeader = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1]; // Only extract the token part
    }
    return null;
};

// Create a post
router.post('/create', async (req, res) => {
    const token = getTokenFromHeader(req);
    const { content } = req.body;

    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const newPost = new Post({ content, author: userId });
        await newPost.save();

        const populatedPost = await newPost.populate('author', 'username avatarname avatarimg');

        res.json({ message: 'Post created successfully', post: populatedPost });

        if (process.env.DEBUG) console.log(`[DEBUG] -> User posted`)
    } catch (err) {
        console.error('Post Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/all', async (req, res) => {
    try {
        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .populate('author', 'username avatarname avatarimg');

        res.json({ posts });
    } catch (err) {
        console.error('Fetch Posts Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a post
router.delete('/delete/:id', async (req, res) => {
    const token = getTokenFromHeader(req);
    const postId = req.params.id;

    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post does not exist' });

        // Only the author can delete their own post
        if (post.author.toString() !== userId) {
            return res.status(403).json({ message: 'You do not have permission to delete this post' });
        }

        await Post.findByIdAndDelete(postId);
        res.json({ message: 'Post deleted successfully' });

        if (process.env.DEBUG) console.log(`[DEBUG] -> Post deleted by user ${userId}`);
    } catch (err) {
        console.error('Delete Post Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reply to a post (essentially creating a new post but with a parent)
router.post('/reply/:parentId', async (req, res) => {
    const token = getTokenFromHeader(req);
    const { content } = req.body;
    const parentId = req.params.parentId;

    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // Check if the parent post exists
        const parentPost = await Post.findById(parentId);
        if (!parentPost) return res.status(404).json({ message: 'Original post does not exist' });

        const replyPost = new Post({
            content,
            author: userId,
            parent: parentId,
        });

        await replyPost.save();
        const populatedReply = await replyPost.populate('author', 'username avatarname avatarimg');

        res.json({ message: 'Reply successful', reply: populatedReply });

        if (process.env.DEBUG) console.log(`[DEBUG] -> User ${userId} replied to post ${parentId}`);
    } catch (err) {
        console.error('Reply Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/:id/replies', async (req, res) => {
    const postId = req.params.id;

    try {
        const replies = await Post.find({ parent: postId })
            .sort({ createdAt: 1 })
            .populate('author', 'username avatarname avatarimg');

        res.json({ replies });
    } catch (err) {
        console.error('Fetch Replies Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/fetch', async (req, res) => {
    try {
        const { userId, keyword, limit = 20 } = req.query;

        // Initialize query conditions
        const query = {};

        // ✅ Verify if the userId is a valid ObjectId (to prevent errors)
        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ message: 'Invalid userId' });
            }
            query.author = userId;
        }

        // ✅ Handle keyword search (case insensitive)
        if (keyword && typeof keyword === 'string') {
            query.content = { $regex: keyword, $options: 'i' };
        }

        // ✅ Safely handle limit (to avoid NaN)
        const parsedLimit = Math.max(1, parseInt(limit) || 20);

        // Query main posts
        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .limit(parsedLimit)
            .populate('author', 'username avatarname avatarimg');

        // Handle nested replies
        const postsWithReplies = await Promise.all(
            posts.map(async (post) => {
                const replies = await Post.find({ parent: post._id })
                    .sort({ createdAt: 1 })
                    .populate('author', 'username avatarname avatarimg');

                return {
                    ...post.toObject(),
                    replies,
                };
            })
        );

        res.json({ posts: postsWithReplies });
    } catch (err) {
        console.error('Fetch Posts with Replies Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get details of a single post
router.get('/:id', async (req, res) => {
    const postId = req.params.id;

    try {
        const post = await Post.findById(postId).populate('author', 'username avatarname avatarimg');
        if (!post) return res.status(404).json({ message: 'Post does not exist' });

        res.json({ post });
    } catch (err) {
        console.error('Fetch Single Post Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
