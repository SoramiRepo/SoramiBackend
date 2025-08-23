# OSS (对象存储服务) 配置指南

本项目支持多种对象存储服务提供商，可以根据需要灵活切换。

## 支持的 OSS 提供商

- **MinIO** - 自托管的 S3 兼容对象存储
- **AWS S3** - 亚马逊云服务
- **阿里云 OSS** - 阿里巴巴云对象存储（计划支持）
- **腾讯云 COS** - 腾讯云对象存储（计划支持）
- **七牛云** - 七牛云存储（计划支持）

## 配置说明

### 通用配置

在 `.env` 文件中设置以下变量：

```env
# OSS 提供商选择
OSS_PROVIDER=minio

# 基础配置
OSS_ENDPOINT=localhost
OSS_PORT=9000
OSS_ACCESS_KEY=your_access_key
OSS_SECRET_KEY=your_secret_key
OSS_BUCKET=your_bucket_name
OSS_USE_SSL=false
OSS_REGION=us-east-1

# 高级配置
OSS_PUBLIC_READ=true
OSS_CDN_DOMAIN=https://cdn.yourdomain.com
```

### MinIO 配置

适用于本地开发或自托管环境：

```env
OSS_PROVIDER=minio
OSS_ENDPOINT=localhost
OSS_PORT=9000
OSS_ACCESS_KEY=admin
OSS_SECRET_KEY=admin123
OSS_BUCKET=soramidev
OSS_USE_SSL=false
OSS_REGION=us-east-1
OSS_PUBLIC_READ=true
```

### AWS S3 配置

适用于生产环境：

```env
OSS_PROVIDER=aws-s3
OSS_ENDPOINT=s3.amazonaws.com
OSS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
OSS_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
OSS_BUCKET=my-production-bucket
OSS_USE_SSL=true
OSS_REGION=us-east-1
OSS_PUBLIC_READ=true
OSS_CDN_DOMAIN=https://d123456789.cloudfront.net
```

### 阿里云 OSS 配置（计划支持）

```env
OSS_PROVIDER=aliyun-oss
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_ACCESS_KEY=your_aliyun_access_key
OSS_SECRET_KEY=your_aliyun_secret_key
OSS_BUCKET=your_aliyun_bucket
OSS_USE_SSL=true
OSS_REGION=oss-cn-hangzhou
OSS_PUBLIC_READ=true
```

## API 接口

### 上传接口

- `POST /api/upload/image` - 单张图片上传
- `POST /api/upload/images` - 多张图片上传（最多5张）
- `POST /api/upload/avatar` - 头像上传
- `POST /api/upload/file` - 通用文件上传
- `POST /api/upload/files` - 多文件上传（最多3个）

### 管理接口

- `DELETE /api/upload/file/:fileName` - 删除文件
- `GET /api/upload/file/:fileName/info` - 获取文件信息
- `GET /api/upload/file/:fileName/exists` - 检查文件是否存在
- `GET /api/upload/file/:fileName/url` - 获取文件访问URL
- `GET /api/upload/status` - 获取OSS服务状态

### 上传示例

```javascript
// 单张图片上传
const formData = new FormData();
formData.append('image', file);

const response = await fetch('/api/upload/image', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`
    },
    body: formData
});

const result = await response.json();
console.log('上传成功:', result.file.url);
```

## 文件类型支持

### 图片类型
- JPEG/JPG
- PNG
- GIF
- WebP

### 其他文件类型
- PDF
- TXT
- DOC/DOCX

## 文件大小限制

- **图片文件**: 最大 5MB
- **头像文件**: 最大 1MB
- **普通文件**: 最大 10MB

## CDN 配置

如果配置了 `OSS_CDN_DOMAIN`，系统会优先使用 CDN 域名生成文件访问链接，提高访问速度。

```env
OSS_CDN_DOMAIN=https://cdn.yourdomain.com
```

## 生产环境部署

### 1. 选择 OSS 提供商

根据你的需求选择合适的 OSS 提供商：

- **成本敏感**: MinIO（自托管）
- **全球化应用**: AWS S3
- **中国用户**: 阿里云 OSS / 腾讯云 COS

### 2. 安全配置

- 使用强密码作为 `OSS_ACCESS_KEY` 和 `OSS_SECRET_KEY`
- 生产环境必须启用 SSL (`OSS_USE_SSL=true`)
- 合理设置存储桶权限

### 3. 监控和备份

- 定期监控存储使用量
- 设置文件备份策略
- 监控访问日志

## 故障排除

### 常见错误

1. **连接错误**
   - 检查 `OSS_ENDPOINT` 和 `OSS_PORT` 配置
   - 确认网络连接正常

2. **认证失败**
   - 验证 `OSS_ACCESS_KEY` 和 `OSS_SECRET_KEY`
   - 检查密钥权限

3. **存储桶不存在**
   - 确认 `OSS_BUCKET` 名称正确
   - 检查存储桶是否已创建

4. **文件上传失败**
   - 检查文件大小限制
   - 验证文件类型支持

### 调试模式

启用调试模式获取详细错误信息：

```env
DEBUG=true
```

## 迁移指南

### 从 MinIO 迁移到 AWS S3

1. 修改环境变量：
   ```env
   OSS_PROVIDER=aws-s3
   OSS_ENDPOINT=s3.amazonaws.com
   OSS_ACCESS_KEY=your_aws_key
   OSS_SECRET_KEY=your_aws_secret
   OSS_USE_SSL=true
   ```

2. 迁移现有文件（可选）
3. 更新应用配置
4. 测试上传功能

由于使用了统一的接口，代码无需修改，只需更改配置即可完成迁移。
