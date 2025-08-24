import express from 'express';
import mongoose from 'mongoose';
import { getOSSConfig } from '../utils/ossClient.js';
import logger from '../utils/logger.js';

const router = express.Router();

// 健康检查端点
router.get('/', async (req, res) => {
    try {
        const health = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0'
        };

        // 检查数据库连接
        try {
            if (mongoose.connection.readyState === 1) {
                health.database = 'connected';
            } else {
                health.database = 'disconnected';
                health.status = 'WARNING';
            }
        } catch (error) {
            health.database = 'error';
            health.status = 'ERROR';
            logger.error('Database health check failed', error);
        }

        // 检查 OSS 配置
        try {
            const ossConfig = getOSSConfig();
            health.oss = {
                provider: ossConfig.provider,
                endpoint: ossConfig.endpoint,
                bucket: ossConfig.bucket,
                publicRead: ossConfig.publicRead
            };
        } catch (error) {
            health.oss = 'error';
            health.status = 'ERROR';
            logger.error('OSS health check failed', error);
        }

        // 检查内存使用
        const memUsage = process.memoryUsage();
        health.memory = {
            rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
            external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
        };

        // 根据状态设置响应码
        const statusCode = health.status === 'OK' ? 200 : 
                          health.status === 'WARNING' ? 200 : 503;

        res.status(statusCode).json(health);
        
    } catch (error) {
        logger.error('Health check failed', error);
        res.status(503).json({
            status: 'ERROR',
            message: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});

// 详细状态检查
router.get('/detailed', async (req, res) => {
    try {
        const detailedHealth = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            pid: process.pid,
            platform: process.platform,
            nodeVersion: process.version,
            arch: process.arch
        };

        // 数据库详细状态
        try {
            detailedHealth.database = {
                status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                readyState: mongoose.connection.readyState,
                host: mongoose.connection.host,
                port: mongoose.connection.port,
                name: mongoose.connection.name
            };
        } catch (error) {
            detailedHealth.database = { status: 'error', error: error.message };
        }

        // 系统资源
        const memUsage = process.memoryUsage();
        detailedHealth.system = {
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external
            },
            cpu: process.cpuUsage(),
            resourceUsage: process.resourceUsage()
        };

        res.json(detailedHealth);
        
    } catch (error) {
        logger.error('Detailed health check failed', error);
        res.status(503).json({
            status: 'ERROR',
            message: 'Detailed health check failed',
            error: error.message
        });
    }
});

export default router;
