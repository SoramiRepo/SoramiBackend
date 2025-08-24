import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Access token required' });
        }

        const token = authHeader.split(' ')[1];

        if (!token || token.trim().length === 0) {
            return res.status(401).json({ message: 'Invalid token format' });
        }
        
        if (process.env.DEBUG === 'true') {
            logger.debug(`Auth token received`, { tokenPreview: token.substring(0, 20) + '...' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 验证token是否过期
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            return res.status(401).json({ message: 'Token expired' });
        }
        
        // 验证必要字段
        if (!decoded.userId || !decoded.username) {
            return res.status(401).json({ message: 'Invalid token payload' });
        }
        
        // 验证字段类型
        if (typeof decoded.userId !== 'string' || typeof decoded.username !== 'string') {
            return res.status(401).json({ message: 'Invalid token payload format' });
        }
        
        req.user = {
            userId: decoded.userId,
            username: decoded.username
        };
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        } else if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        } else {
            logger.error('Token verification failed', err);
            return res.status(401).json({ message: 'Token verification failed' });
        }
    }
};

export default authMiddleware;
