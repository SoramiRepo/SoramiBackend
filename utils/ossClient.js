import { Client } from 'minio';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

// OSS 配置
const ossConfig = {
    provider: process.env.OSS_PROVIDER || 'minio',
    endpoint: process.env.OSS_ENDPOINT || 'localhost',
    port: parseInt(process.env.OSS_PORT) || 9000,
    useSSL: process.env.OSS_USE_SSL === 'true',
    accessKey: process.env.OSS_ACCESS_KEY || 'admin',
    secretKey: process.env.OSS_SECRET_KEY || 'admin123',
    bucket: process.env.OSS_BUCKET || 'soramidev',
    region: process.env.OSS_REGION || 'us-east-1',
    publicRead: process.env.OSS_PUBLIC_READ === 'true',
    cdnDomain: process.env.OSS_CDN_DOMAIN || ''
};

// 创建客户端（当前支持 MinIO/S3 兼容）
const createOSSClient = () => {
    try {
        switch (ossConfig.provider) {
            case 'minio':
            case 'aws-s3':
            default:
                return new Client({
                    endPoint: ossConfig.endpoint,
                    port: ossConfig.port,
                    useSSL: ossConfig.useSSL,
                    accessKey: ossConfig.accessKey,
                    secretKey: ossConfig.secretKey,
                    region: ossConfig.region,
                    // 增加超时配置
                    connectTimeout: 10000,
                    readTimeout: 30000
                });
        }
    } catch (error) {
        logger.error('Failed to create OSS client', error);
        throw error;
    }
};

const ossClient = createOSSClient();

// 获取存储桶名称
export const getBucketName = () => {
    return ossConfig.bucket;
};

// 获取 OSS 配置
export const getOSSConfig = () => {
    return { ...ossConfig };
};

// 初始化存储桶（如果不存在则创建）
export const initializeBucket = async () => {
    try {
        const bucketName = getBucketName();
        const config = getOSSConfig();
        
        logger.file(`Initializing ${config.provider.toUpperCase()} bucket`, bucketName);
        
        const bucketExists = await ossClient.bucketExists(bucketName);
        
        if (!bucketExists) {
            await ossClient.makeBucket(bucketName, config.region);
            logger.success(`${config.provider.toUpperCase()} bucket '${bucketName}' created successfully`);
            
            // 设置存储桶策略，允许公开读取（如果启用）
            if (config.publicRead) {
                const policy = {
                    Version: "2012-10-17",
                    Statement: [
                        {
                            Effect: "Allow",
                            Principal: {"AWS": ["*"]},
                            Action: ["s3:GetObject"],
                            Resource: [`arn:aws:s3:::${bucketName}/*`]
                        }
                    ]
                };
                
                try {
                    await ossClient.setBucketPolicy(bucketName, JSON.stringify(policy));
                    logger.success(`${config.provider.toUpperCase()} bucket '${bucketName}' policy set to public read`);
                } catch (policyError) {
                    logger.warn(`Could not set public read policy: ${policyError.message}`);
                }
            }
        } else {
            logger.success(`${config.provider.toUpperCase()} bucket '${bucketName}' already exists`);
        }
    } catch (error) {
        logger.error(`${ossConfig.provider.toUpperCase()} bucket initialization error`, error);
        throw error;
    }
};

// 上传文件到 OSS
export const uploadToOSS = async (fileName, fileBuffer, contentType) => {
    try {
        const bucketName = getBucketName();
        const config = getOSSConfig();
        
        // 添加时间戳前缀避免文件名冲突
        const timestamp = Date.now();
        const uniqueFileName = `${timestamp}-${fileName}`;
        
        const metaData = {
            'Content-Type': contentType,
        };
        
        await ossClient.putObject(bucketName, uniqueFileName, fileBuffer, metaData);
        
        // 生成文件访问 URL
        const fileUrl = await getFileUrl(uniqueFileName);
        
        return {
            fileName: uniqueFileName,
            originalName: fileName,
            url: fileUrl,
            contentType,
            size: fileBuffer.length,
            provider: config.provider
        };
    } catch (error) {
        console.error(`${ossConfig.provider.toUpperCase()} upload error:`, error);
        throw error;
    }
};

// 为了向后兼容，保留原函数名
export const uploadToMinio = uploadToOSS;

// 获取文件访问 URL
export const getFileUrl = async (fileName) => {
    try {
        const bucketName = getBucketName();
        const config = getOSSConfig();
        
        // 如果有 CDN 域名，优先使用 CDN
        if (config.cdnDomain) {
            return `${config.cdnDomain}/${fileName}`;
        }
        
        // 根据不同 OSS 提供商生成 URL
        switch (config.provider) {
            case 'aws-s3':
                const protocol = config.useSSL ? 'https' : 'http';
                if (config.endpoint === 's3.amazonaws.com') {
                    return `${protocol}://${bucketName}.s3.${config.region}.amazonaws.com/${fileName}`;
                } else {
                    return `${protocol}://${config.endpoint}/${bucketName}/${fileName}`;
                }
                
            case 'minio':
            default:
                const minioProtocol = config.useSSL ? 'https' : 'http';
                const portSuffix = (config.port && config.port !== 80 && config.port !== 443) ? `:${config.port}` : '';
                return `${minioProtocol}://${config.endpoint}${portSuffix}/${bucketName}/${fileName}`;
        }
    } catch (error) {
        console.error('Error generating file URL:', error);
        throw error;
    }
};

// 删除文件
export const deleteFromOSS = async (fileName) => {
    try {
        const bucketName = getBucketName();
        await ossClient.removeObject(bucketName, fileName);
        return true;
    } catch (error) {
        console.error(`${ossConfig.provider.toUpperCase()} delete error:`, error);
        throw error;
    }
};

// 为了向后兼容，保留原函数名
export const deleteFromMinio = deleteFromOSS;

// 检查文件是否存在
export const fileExists = async (fileName) => {
    try {
        const bucketName = getBucketName();
        await ossClient.statObject(bucketName, fileName);
        return true;
    } catch (error) {
        return false;
    }
};

// 获取文件信息
export const getFileInfo = async (fileName) => {
    try {
        const bucketName = getBucketName();
        const config = getOSSConfig();
        const stat = await ossClient.statObject(bucketName, fileName);
        return {
            fileName,
            size: stat.size,
            lastModified: stat.lastModified,
            contentType: stat.metaData['content-type'],
            provider: config.provider
        };
    } catch (error) {
        console.error('Error getting file info:', error);
        throw error;
    }
};

// 获取 OSS 状态信息
export const getOSSStatus = () => {
    const config = getOSSConfig();
    return {
        provider: config.provider,
        endpoint: config.endpoint,
        bucket: config.bucket,
        region: config.region,
        ssl: config.useSSL,
        publicRead: config.publicRead,
        cdnDomain: config.cdnDomain || null
    };
};

export default ossClient;
