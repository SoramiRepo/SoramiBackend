import { webcrypto } from 'crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

import logger from './utils/logger.js';
import { requestLogger, errorLogger } from './middleware/loggerMiddleware.js';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
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
import passkeyRoutes from './routes/passkey.js';
import uploadRoutes from './routes/upload.js';
import messageRoutes from './routes/message.js';
import SocketServer from './utils/socketServer.js';

const app = express();

// Check and create .env if not exists
const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
    const envTemplate = `PORT=3000
MONGO_URI=mongodb://localhost:27017/soramidev
JWT_SECRET=your_jwt_secret_here_change_this_in_production
ALLOW_REGISTER=true
DEBUG=false
OSS_PROVIDER=minio
OSS_ENDPOINT=localhost
OSS_PORT=9000
OSS_ACCESS_KEY=admin
OSS_SECRET_KEY=admin123
OSS_BUCKET=soramidev
OSS_USE_SSL=false
OSS_REGION=us-east-1
OSS_PUBLIC_READ=true
RP_ID=localhost
RP_NAME=Sorami
RP_ORIGIN=http://localhost:5174
CORS_ORIGIN=http://localhost:5174
`;
    try {
        fs.writeFileSync(envPath, envTemplate);
        logger.warn('.env file not found. A template has been created. Please fill it in before restarting the server.');
        process.exit(1);
    } catch (error) {
        logger.error('Failed to create .env file', error);
        process.exit(1);
    }
}
dotenv.config();

// Setup log directories
const logDir = path.resolve('logs');
try {
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
} catch (error) {
    logger.error('Failed to create logs directory', error);
    process.exit(1);
}

// Get current date for log file naming
const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

// Create daily access and error log files
let accessLogStream, errorLogStream;
try {
    accessLogStream = fs.createWriteStream(path.join(logDir, `access-${currentDate}.log`), { flags: 'a' });
    errorLogStream = fs.createWriteStream(path.join(logDir, `error-${currentDate}.log`), { flags: 'a' });
    
    // Handle stream errors
    accessLogStream.on('error', (error) => {
        logger.error('Access log stream error', error);
    });
    
    errorLogStream.on('error', (error) => {
        logger.error('Error log stream error', error);
    });
} catch (error) {
    logger.error('Failed to create log streams', error);
    process.exit(1);
}

// Custom morgan tokens
morgan.token('remote-ip', req => req.headers['x-forwarded-for'] || req.socket.remoteAddress);
const logFormat = ':remote-ip - [:date[iso]] ":method :url" :status';

// Request logging (access)
app.use(morgan(logFormat, { stream: accessLogStream }));
app.use(morgan(logFormat)); // also log to console

// JSON + CORS
app.use(cors());
app.use(express.json());

// Logger middleware
app.use(requestLogger);

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
connectDB().catch((error) => {
    logger.error('Failed to connect to database', error);
    process.exit(1);
});

// Initialize MinIO
initializeBucket().catch((error) => {
    logger.error('Failed to initialize bucket', error);
    // Don't exit here, just log the error
});

// Routes
app.use('/api/user', userRoutes);
app.use('/api/post', postRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/passkey', passkeyRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/message', messageRoutes);

// Health check routes
app.use('/health', healthRoutes);

// 404 fallback
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    logger.server('Server started', PORT);
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        logger.warn('Please try a different port or stop the process using this port');
    } else {
        logger.error('Server startup error', error);
    }
    process.exit(1);
});

// Initialize WebSocket server
const socketServer = new SocketServer(server);
logger.info('WebSocket server initialized');

// Make socket server available globally for controllers
global.socketServer = socketServer;
