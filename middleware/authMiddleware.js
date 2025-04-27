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
        req.userId = null;
        return next(); // 如果不这样写会一直尝试验证，消耗服务器资源
    }
    next();
};

export default authMiddleware;
