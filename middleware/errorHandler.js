import logger from '../utils/logger.js';

// 全局错误处理中间件
export const globalErrorHandler = (err, req, res, next) => {
    // 记录错误
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
    });

    // 根据错误类型返回不同的状态码
    let statusCode = 500;
    let message = 'Internal Server Error';

    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
    } else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
    } else if (err.name === 'MongoError' && err.code === 11000) {
        statusCode = 409;
        message = 'Duplicate key error';
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    } else if (err.status) {
        statusCode = err.status;
        message = err.message;
    }

    // 生产环境不暴露错误详情
    const isProduction = process.env.NODE_ENV === 'production';
    
    const response = {
        message,
        ...(isProduction ? {} : { 
            error: err.message,
            stack: err.stack 
        })
    };

    res.status(statusCode).json(response);
};

// 异步错误包装器
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// 404 处理
export const notFoundHandler = (req, res) => {
    logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
};
