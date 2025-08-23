import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// 支持的图片类型
const ALLOWED_IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
};

// 支持的文件类型（图片 + 其他文件）
const ALLOWED_FILE_TYPES = {
    ...ALLOWED_IMAGE_TYPES,
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

// 文件大小限制 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 图片大小限制 (5MB)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// 内存存储配置
const storage = multer.memoryStorage();

// 文件过滤器
const createFileFilter = (allowedTypes, maxSize) => {
    return (req, file, cb) => {
        // 检查文件类型
        if (!allowedTypes[file.mimetype]) {
            const allowedExtensions = Object.values(allowedTypes).join(', ');
            return cb(new Error(`File type not allowed. Allowed types: ${allowedExtensions}`), false);
        }
        
        // 文件类型检查通过
        cb(null, true);
    };
};

// 图片上传中间件
export const uploadImage = multer({
    storage,
    limits: {
        fileSize: MAX_IMAGE_SIZE,
        files: 1
    },
    fileFilter: createFileFilter(ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE)
});

// 多图片上传中间件 (最多5张)
export const uploadMultipleImages = multer({
    storage,
    limits: {
        fileSize: MAX_IMAGE_SIZE,
        files: 5
    },
    fileFilter: createFileFilter(ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE)
});

// 通用文件上传中间件
export const uploadFile = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    },
    fileFilter: createFileFilter(ALLOWED_FILE_TYPES, MAX_FILE_SIZE)
});

// 多文件上传中间件 (最多3个文件)
export const uploadMultipleFiles = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 3
    },
    fileFilter: createFileFilter(ALLOWED_FILE_TYPES, MAX_FILE_SIZE)
});

// 头像上传中间件 (特殊处理，1MB限制)
export const uploadAvatar = multer({
    storage,
    limits: {
        fileSize: 1 * 1024 * 1024, // 1MB
        files: 1
    },
    fileFilter: createFileFilter(ALLOWED_IMAGE_TYPES, 1 * 1024 * 1024)
});

// 错误处理中间件
export const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    message: 'File size too large',
                    error: 'File exceeds maximum allowed size'
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    message: 'Too many files',
                    error: 'Exceeded maximum number of files allowed'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    message: 'Unexpected file field',
                    error: 'File field name not expected'
                });
            default:
                return res.status(400).json({
                    message: 'Upload error',
                    error: error.message
                });
        }
    }
    
    if (error.message.includes('File type not allowed')) {
        return res.status(400).json({
            message: 'Invalid file type',
            error: error.message
        });
    }
    
    // 其他错误传递给下一个错误处理器
    next(error);
};

// 生成唯一文件名
export const generateUniqueFileName = (originalName) => {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const uuid = uuidv4();
    return `${name}-${uuid}${ext}`;
};

// 验证图片文件
export const validateImageFile = (file) => {
    if (!file) {
        throw new Error('No file provided');
    }
    
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
        const allowedTypes = Object.values(ALLOWED_IMAGE_TYPES).join(', ');
        throw new Error(`Invalid image type. Allowed types: ${allowedTypes}`);
    }
    
    if (file.size > MAX_IMAGE_SIZE) {
        throw new Error(`Image size too large. Maximum size: ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
    }
    
    return true;
};

// 验证文件
export const validateFile = (file) => {
    if (!file) {
        throw new Error('No file provided');
    }
    
    if (!ALLOWED_FILE_TYPES[file.mimetype]) {
        const allowedTypes = Object.values(ALLOWED_FILE_TYPES).join(', ');
        throw new Error(`Invalid file type. Allowed types: ${allowedTypes}`);
    }
    
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }
    
    return true;
};
