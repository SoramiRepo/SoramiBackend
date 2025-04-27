import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.userId = null;
        return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        req.userId = null;
        return next();
    }
    
    if (process.env.DEBUG) console.log('[DEBUG] authMiddleware -> Token:', token);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId; // 操你妈这个bug修了半天
    } catch (err) {
        console.error('Token verification failed:', err);
        res.status(403).json({ message: 'Invalid token' });
    }
    next();
};

export default authMiddleware;
