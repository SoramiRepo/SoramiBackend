import logger from '../utils/logger.js';

// 通用验证中间件
export const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const { error } = schema.validate(req.body);
            if (error) {
                logger.warn('Validation error', {
                    error: error.details[0].message,
                    body: req.body,
                    url: req.originalUrl
                });
                return res.status(400).json({
                    message: 'Validation failed',
                    details: error.details[0].message
                });
            }
            next();
        } catch (err) {
            logger.error('Validation middleware error', err);
            return res.status(500).json({ message: 'Validation error' });
        }
    };
};

// 检查必需字段
export const requireFields = (fields) => {
    return (req, res, next) => {
        const missingFields = [];
        
        for (const field of fields) {
            if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
                missingFields.push(field);
            }
        }
        
        if (missingFields.length > 0) {
            logger.warn('Missing required fields', {
                missingFields,
                body: req.body,
                url: req.originalUrl
            });
            return res.status(400).json({
                message: 'Missing required fields',
                missingFields
            });
        }
        
        next();
    };
};

// 检查字段类型
export const validateFieldTypes = (fieldTypes) => {
    return (req, res, next) => {
        const typeErrors = [];
        
        for (const [field, expectedType] of Object.entries(fieldTypes)) {
            if (req.body[field] !== undefined) {
                const actualType = typeof req.body[field];
                if (actualType !== expectedType) {
                    typeErrors.push({
                        field,
                        expected: expectedType,
                        actual: actualType
                    });
                }
            }
        }
        
        if (typeErrors.length > 0) {
            logger.warn('Field type validation failed', {
                typeErrors,
                body: req.body,
                url: req.originalUrl
            });
            return res.status(400).json({
                message: 'Field type validation failed',
                typeErrors
            });
        }
        
        next();
    };
};

// 检查字段长度
export const validateFieldLength = (fieldLengths) => {
    return (req, res, next) => {
        const lengthErrors = [];
        
        for (const [field, { min, max }] of Object.entries(fieldLengths)) {
            if (req.body[field] !== undefined) {
                const length = String(req.body[field]).length;
                if (min !== undefined && length < min) {
                    lengthErrors.push({
                        field,
                        message: `Minimum length is ${min} characters`,
                        actual: length
                    });
                }
                if (max !== undefined && length > max) {
                    lengthErrors.push({
                        field,
                        message: `Maximum length is ${max} characters`,
                        actual: length
                    });
                }
            }
        }
        
        if (lengthErrors.length > 0) {
            logger.warn('Field length validation failed', {
                lengthErrors,
                body: req.body,
                url: req.originalUrl
            });
            return res.status(400).json({
                message: 'Field length validation failed',
                lengthErrors
            });
        }
        
        next();
    };
};
