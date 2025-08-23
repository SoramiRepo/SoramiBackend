import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
    uploadImage,
    uploadMultipleImages,
    uploadFile,
    uploadMultipleFiles,
    uploadAvatar,
    handleUploadError,
    generateUniqueFileName,
    validateImageFile,
    validateFile
} from '../middleware/uploadMiddleware.js';
import {
    uploadToOSS,
    uploadToMinio, // 保持向后兼容
    deleteFromOSS,
    deleteFromMinio, // 保持向后兼容
    getFileUrl,
    fileExists,
    getFileInfo,
    getOSSStatus
} from '../utils/ossClient.js';

const router = express.Router();

// 单张图片上传
router.post('/image', authMiddleware, uploadImage.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided' });
        }

        validateImageFile(req.file);
        
        const uniqueFileName = generateUniqueFileName(req.file.originalname);
        const uploadResult = await uploadToOSS(
            uniqueFileName,
            req.file.buffer,
            req.file.mimetype
        );

        res.json({
            message: 'Image uploaded successfully',
            file: uploadResult
        });
    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({ 
            message: 'Failed to upload image', 
            error: error.message 
        });
    }
});

// 多张图片上传
router.post('/images', authMiddleware, uploadMultipleImages.array('images', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No image files provided' });
        }

        const uploadResults = [];
        
        for (const file of req.files) {
            validateImageFile(file);
            
            const uniqueFileName = generateUniqueFileName(file.originalname);
            const uploadResult = await uploadToOSS(
                uniqueFileName,
                file.buffer,
                file.mimetype
            );
            
            uploadResults.push(uploadResult);
        }

        res.json({
            message: `${uploadResults.length} images uploaded successfully`,
            files: uploadResults
        });
    } catch (error) {
        console.error('Multiple images upload error:', error);
        res.status(500).json({ 
            message: 'Failed to upload images', 
            error: error.message 
        });
    }
});

// 头像上传
router.post('/avatar', authMiddleware, uploadAvatar.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No avatar file provided' });
        }

        validateImageFile(req.file);
        
        const userId = req.user.userId;
        const fileName = `avatar-${userId}-${Date.now()}.${req.file.mimetype.split('/')[1]}`;
        
        const uploadResult = await uploadToOSS(
            fileName,
            req.file.buffer,
            req.file.mimetype
        );

        // 这里可以更新用户的头像URL到数据库
        // await User.findByIdAndUpdate(userId, { avatarimg: uploadResult.url });

        res.json({
            message: 'Avatar uploaded successfully',
            file: uploadResult
        });
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ 
            message: 'Failed to upload avatar', 
            error: error.message 
        });
    }
});

// 通用文件上传
router.post('/file', authMiddleware, uploadFile.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file provided' });
        }

        validateFile(req.file);
        
        const uniqueFileName = generateUniqueFileName(req.file.originalname);
        const uploadResult = await uploadToOSS(
            uniqueFileName,
            req.file.buffer,
            req.file.mimetype
        );

        res.json({
            message: 'File uploaded successfully',
            file: uploadResult
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ 
            message: 'Failed to upload file', 
            error: error.message 
        });
    }
});

// 多文件上传
router.post('/files', authMiddleware, uploadMultipleFiles.array('files', 3), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files provided' });
        }

        const uploadResults = [];
        
        for (const file of req.files) {
            validateFile(file);
            
            const uniqueFileName = generateUniqueFileName(file.originalname);
            const uploadResult = await uploadToOSS(
                uniqueFileName,
                file.buffer,
                file.mimetype
            );
            
            uploadResults.push(uploadResult);
        }

        res.json({
            message: `${uploadResults.length} files uploaded successfully`,
            files: uploadResults
        });
    } catch (error) {
        console.error('Multiple files upload error:', error);
        res.status(500).json({ 
            message: 'Failed to upload files', 
            error: error.message 
        });
    }
});

// 删除文件
router.delete('/file/:fileName', authMiddleware, async (req, res) => {
    try {
        const { fileName } = req.params;
        
        if (!fileName) {
            return res.status(400).json({ message: 'File name is required' });
        }

        const exists = await fileExists(fileName);
        if (!exists) {
            return res.status(404).json({ message: 'File not found' });
        }

        await deleteFromOSS(fileName);

        res.json({
            message: 'File deleted successfully',
            fileName
        });
    } catch (error) {
        console.error('File delete error:', error);
        res.status(500).json({ 
            message: 'Failed to delete file', 
            error: error.message 
        });
    }
});

// 获取文件信息
router.get('/file/:fileName/info', async (req, res) => {
    try {
        const { fileName } = req.params;
        
        if (!fileName) {
            return res.status(400).json({ message: 'File name is required' });
        }

        const exists = await fileExists(fileName);
        if (!exists) {
            return res.status(404).json({ message: 'File not found' });
        }

        const fileInfo = await getFileInfo(fileName);
        const fileUrl = await getFileUrl(fileName);

        res.json({
            ...fileInfo,
            url: fileUrl
        });
    } catch (error) {
        console.error('Get file info error:', error);
        res.status(500).json({ 
            message: 'Failed to get file info', 
            error: error.message 
        });
    }
});

// 检查文件是否存在
router.get('/file/:fileName/exists', async (req, res) => {
    try {
        const { fileName } = req.params;
        
        if (!fileName) {
            return res.status(400).json({ message: 'File name is required' });
        }

        const exists = await fileExists(fileName);

        res.json({
            fileName,
            exists
        });
    } catch (error) {
        console.error('Check file exists error:', error);
        res.status(500).json({ 
            message: 'Failed to check file existence', 
            error: error.message 
        });
    }
});

// 获取文件访问URL
router.get('/file/:fileName/url', async (req, res) => {
    try {
        const { fileName } = req.params;
        
        if (!fileName) {
            return res.status(400).json({ message: 'File name is required' });
        }

        const exists = await fileExists(fileName);
        if (!exists) {
            return res.status(404).json({ message: 'File not found' });
        }

        const fileUrl = await getFileUrl(fileName);

        res.json({
            fileName,
            url: fileUrl
        });
    } catch (error) {
        console.error('Get file URL error:', error);
        res.status(500).json({ 
            message: 'Failed to get file URL', 
            error: error.message 
        });
    }
});

// 获取 OSS 服务状态
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const status = getOSSStatus();
        res.json({
            message: 'OSS status retrieved successfully',
            status
        });
    } catch (error) {
        console.error('Get OSS status error:', error);
        res.status(500).json({ 
            message: 'Failed to get OSS status', 
            error: error.message 
        });
    }
});

// 应用错误处理中间件
router.use(handleUploadError);

export default router;
