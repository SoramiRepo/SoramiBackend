import express from 'express';
import Post from '../models/Post.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

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
router.post('/create', async (req, res) => {
    const token = getTokenFromHeader(req);
    const { content } = req.body;

    if (!token) return res.status(401).json({ message: 'Missing token' });
    
    // 验证内容
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ message: 'Post content is required' });
    }
    
    if (content.length > 1000) {
        return res.status(400).json({ message: 'Post content too long (max 1000 characters)' });
    }

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
    
    // 验证帖子ID
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return res.status(400).json({ message: 'Valid post ID is required' });
    }

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
router.post('/reply/:parentId', async (req, res) => {
    const token = getTokenFromHeader(req);
    const { content } = req.body;
    const { parentId } = req.params;

    if (!token) return res.status(401).json({ message: 'Missing token' });
    
    // 验证内容
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ message: 'Reply content is required' });
    }
    
    if (content.length > 1000) {
        return res.status(400).json({ message: 'Reply content too long (max 1000 characters)' });
    }
    
    // 验证父帖子ID
    if (!parentId || typeof parentId !== 'string' || parentId.trim().length === 0) {
        return res.status(400).json({ message: 'Valid parent post ID is required' });
    }

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
router.post('/repost', async (req, res) => {
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
    const { id } = req.params;
    
    // 验证帖子ID
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return res.status(400).json({ message: 'Valid post ID is required' });
    }
    
    try {
        const replies = await Post.find({ parent: id })
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

        // 验证用户ID
        if (userId) {
            if (typeof userId !== 'string' || !mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ message: 'Invalid user ID format' });
            }
            query.author = userId;
        }

        // 验证关键词
        if (keyword) {
            if (typeof keyword !== 'string' || keyword.trim().length === 0) {
                return res.status(400).json({ message: 'Invalid keyword' });
            }
            if (keyword.length > 100) {
                return res.status(400).json({ message: 'Keyword too long (max 100 characters)' });
            }
            query.content = { $regex: keyword.trim(), $options: 'i' };
        }

        // 验证限制数量
        const parsedLimit = parseInt(limit);
        if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
            return res.status(400).json({ message: 'Invalid limit (must be between 1 and 100)' });
        }

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

// Like
router.post('/:postId/like', authMiddleware, async (req, res) => {
    const { postId } = req.params;
    const userId = req.userId;
    
    // 验证帖子ID
    if (!postId || typeof postId !== 'string' || postId.trim().length === 0) {
        return res.status(400).json({ message: 'Valid post ID is required' });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        if (post.likes.includes(userId)) {
            return res.status(400).json({ message: 'Already liked' });
        }

        post.likes.push(userId);
        await post.save();

        res.json({ message: 'Liked successfully' });
    } catch (err) {
        console.error('Like Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Unlike
router.post('/:postId/unlike', authMiddleware, async (req, res) => {
    const { postId } = req.params;
    const userId = req.userId;
    
    // 验证帖子ID
    if (!postId || typeof postId !== 'string' || postId.trim().length === 0) {
        return res.status(400).json({ message: 'Valid post ID is required' });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const index = post.likes.indexOf(userId);
        if (index === -1) {
            return res.status(400).json({ message: 'Not liked yet' });
        }

        post.likes.splice(index, 1);
        await post.save();

        res.json({ message: 'Unliked successfully' });
    } catch (err) {
        console.error('Unlike Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get a single post and all its nested replies
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    
    // 验证帖子ID
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return res.status(400).json({ message: 'Valid post ID is required' });
    }
    
    try {
        const post = await Post.findById(id)
            .populate('author', 'username avatarname avatarimg badges')
            .populate({
                path: 'repost',
                populate: {
                    path: 'author',
                    select: 'username avatarname avatarimg badges',
                }
            });

        if (!post) return res.status(404).json({ message: 'Post does not exist' });

        const replies = await getAllReplies(post._id);

        const userId = req.userId ? req.userId : null;

        const formattedPost = {
            ...post.toObject(),
            likeCount: post.likes?.length || 0,
            isLiked: userId ? post.likes?.some(id => id.equals(userId)) : false,
        };

        const formattedReplies = replies.map(reply => ({
            ...reply.toObject(),
            likeCount: reply.likes?.length || 0,
            isLiked: userId ? reply.likes?.some(id => id.equals(userId)) : false,
        }));

        res.json({ post: formattedPost, replies: formattedReplies });
    } catch (err) {
        console.error('Fetch Single Post Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


export default router;
