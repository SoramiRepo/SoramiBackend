import mongoose from 'mongoose';
import logger from './logger.js';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGO_URI environment variable is not set');
        }
        
        // 验证 MongoDB URI 格式
        if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
            throw new Error('Invalid MongoDB URI format');
        }
        
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000, // 10秒超时
            socketTimeoutMS: 45000, // 45秒socket超时
            maxPoolSize: 10, // 连接池大小
            minPoolSize: 2,
            maxIdleTimeMS: 30000, // 最大空闲时间
            retryWrites: true,
            w: 'majority'
        });
        
        // 监听连接事件
        mongoose.connection.on('connected', () => {
            logger.database('MongoDB Connected');
        });
        
        mongoose.connection.on('error', (error) => {
            logger.error('MongoDB connection error', error);
        });
        
        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
        });
        
        // 优雅关闭
        process.on('SIGINT', async () => {
            try {
                await mongoose.connection.close();
                logger.database('MongoDB connection closed through app termination');
                process.exit(0);
            } catch (error) {
                logger.error('Error during MongoDB disconnection', error);
                process.exit(1);
            }
        });
        
    } catch (error) {
        logger.database('MongoDB connection failed', 'error');
        logger.error('MongoDB connection error', error);
        logger.warn('Please check your MongoDB connection and MONGO_URI configuration');
        throw error; // 让调用者决定是否退出
    }
};

export default connectDB;