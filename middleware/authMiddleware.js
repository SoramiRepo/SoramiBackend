import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Invalid token format' });
    }
    
    if (process.env.DEBUG) console.log('[DEBUG] authMiddleware -> Token:', token);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 验证token是否过期
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            return res.status(401).json({ message: 'Token expired' });
        }
        
        // 验证必要字段
        if (!decoded.userId || !decoded.username) {
            return res.status(401).json({ message: 'Invalid token payload' });
        }
        
        req.userId = decoded.userId;
        req.username = decoded.username;
        next();
    } catch (err) {
        console.error('Token verification failed:', err.message);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

export default authMiddleware;
