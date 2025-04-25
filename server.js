import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import morgan from 'morgan';
import connectDB from './utils/db.js';
import userRoutes from './routes/user.js';
import postRoutes from './routes/post.js';
import notificationRoutes from './routes/notification.js';

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

// Connect to DB
connectDB();

// Routes
app.use('/api/user', userRoutes);
app.use('/api/post', postRoutes);
app.use('/api/notification', notificationRoutes);

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
app.listen(PORT, () => {
    console.log(`✅ Server started on port ${PORT}`);
});
