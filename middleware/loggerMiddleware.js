import logger from '../utils/logger.js';

// HTTP 请求日志中间件
export const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    // 重写 res.send 方法来捕获响应时间
    res.send = function(data) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // 记录请求日志
        logger.request(req.method, req.originalUrl, res.statusCode, responseTime);
        
        // 调用原始的 send 方法
        return originalSend.call(this, data);
    };
    
    next();
};

// 错误日志中间件
export const errorLogger = (err, req, res, next) => {
    // 记录错误日志
    logger.error(`${req.method} ${req.originalUrl}`, {
        error: err.message,
        stack: err.stack,
        statusCode: err.statusCode || 500,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });
    
    next(err);
};
