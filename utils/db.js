import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGO_URI environment variable is not set');
        }
        
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000, // 5秒超时
            socketTimeoutMS: 45000, // 45秒socket超时
        });
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        console.error('Please check your MongoDB connection and MONGO_URI configuration');
        process.exit(1);
    }
};

export default connectDB;