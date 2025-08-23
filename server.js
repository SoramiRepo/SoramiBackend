import { webcrypto } from 'crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './utils/db.js';
import { initializeBucket } from './utils/ossClient.js';
import userRoutes from './routes/user.js';
import postRoutes from './routes/post.js';
import notificationRoutes from './routes/notification.js';
import messageRoutes from './routes/message.js';
import passkeyRoutes from './routes/passkey.js';
import uploadRoutes from './routes/upload.js';
import SocketServer from './utils/socketServer.js';

const app = express();

// Check and create .env if not exists
const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
    const envTemplate = `PORT=5000
MONGO_URI=mongodb://localhost:27017/soramidev
JWT_SECRET=test
ALLOW_REGISTER=true
DEBUG=true
`;
    fs.writeFileSync(envPath, envTemplate);
    console.warn('⚠️  .env file not found. A template has been created. Please fill it in before restarting the server.');
    process.exit(1);
}
dotenv.config();

// Setup log directories
const logDir = path.resolve('logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

// Get current date for log file naming
const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

// Create daily access and error log files
const accessLogStream = fs.createWriteStream(path.join(logDir, `access-${currentDate}.log`), { flags: 'a' });
const errorLogStream = fs.createWriteStream(path.join(logDir, `error-${currentDate}.log`), { flags: 'a' });

// Custom morgan tokens
morgan.token('remote-ip', req => req.headers['x-forwarded-for'] || req.socket.remoteAddress);
const logFormat = ':remote-ip - [:date[iso]] ":method :url" :status';

// Request logging (access)
app.use(morgan(logFormat, { stream: accessLogStream }));
app.use(morgan(logFormat)); // also log to console

// JSON + CORS
app.use(cors());
app.use(express.json());

// Security middleware
app.use(helmet());

// Rate limiting - 调整为更宽松的设置
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 从100提高到1000，每个IP在15分钟内最多1000个请求
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true, // 返回 `RateLimit-*` headers
    legacyHeaders: false, // 禁用 `X-RateLimit-*` headers
    skip: (req) => {
        // 跳过OPTIONS请求的速率限制
        return req.method === 'OPTIONS';
    }
});

// 为认证相关路由设置更宽松的速率限制
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 认证相关操作限制更严格
    message: 'Too many authentication attempts, please try again after 15 minutes',
    skip: (req) => req.method === 'OPTIONS'
});

app.use(limiter);
app.use('/api/user', authLimiter); // 用户相关路由使用更严格的限制

// Connect to DB
connectDB();

// Initialize MinIO
initializeBucket().catch(console.error);

// Routes
app.use('/api/user', userRoutes);
app.use('/api/post', postRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/passkey', passkeyRoutes);
app.use('/api/upload', uploadRoutes);

// 404 fallback
app.use((req, res, next) => {
    const msg = `404 Not Found - ${req.method} ${req.path}`;
    console.warn(msg);
    res.status(404).json({ message: "Route not found" });
});

// Error handler middleware (logs to error.log)
app.use((err, req, res, next) => {
    const logEntry = `
[${new Date().toISOString()}] ERROR:
URL: ${req.method} ${req.originalUrl}
IP: ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}
Message: ${err.message}
Stack: ${err.stack}
---------------------------------------------------
`;
    errorLogStream.write(logEntry);
    console.error(err);

    res.status(500).json({ message: 'Internal Server Error' });
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`✅ Server started on port ${PORT}`);
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.error('Please try a different port or stop the process using this port');
    } else {
        console.error('❌ Server startup error:', error);
    }
    process.exit(1);
});

// Initialize WebSocket server
try {
    const socketServer = new SocketServer(server);
    console.log('✅ WebSocket server initialized');
} catch (error) {
    console.error('❌ WebSocket server initialization failed:', error);
    server.close();
    process.exit(1);
}
