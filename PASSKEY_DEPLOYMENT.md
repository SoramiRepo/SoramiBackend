# Passkey 部署配置指南

## 开发环境配置

### 后端 (.env)
```env
# Passkey Configuration for Development
RP_ID=localhost
RP_ORIGIN=http://localhost:5174  # 前端端口
RP_NAME=Sorami
CORS_ORIGIN=http://localhost:5174
```

### 前端 (config.json)
```json
{
    "apiBaseUrl": "http://localhost:3000",
    "passkey": {
        "rpId": "localhost",
        "rpOrigin": "http://localhost:5174"
    }
}
```

## 生产环境配置

### 后端 (.env)
```env
# Passkey Configuration for Production
RP_ID=yourdomain.com              # 你的主域名
RP_ORIGIN=https://yourdomain.com  # 前端域名（必须是 HTTPS）
RP_NAME=Sorami
CORS_ORIGIN=https://yourdomain.com
NODE_ENV=production
DEBUG=false
```

### 前端 (config.production.json)
```json
{
    "apiBaseUrl": "https://api.yourdomain.com",
    "passkey": {
        "rpId": "yourdomain.com",
        "rpOrigin": "https://yourdomain.com"
    }
}
```

## 重要注意事项

### 1. 域名配置
- **RP_ID**: 必须是你的主域名，不包含协议和端口
- **RP_ORIGIN**: 前端的完整 URL，生产环境必须是 HTTPS
- **开发环境**: 可以使用 localhost 和 HTTP
- **生产环境**: 必须使用真实域名和 HTTPS

### 2. 跨域配置
- 确保后端的 CORS_ORIGIN 设置为前端的完整 URL
- 如果前后端在不同子域名，需要正确配置 CORS

### 3. HTTPS 要求
- **生产环境**: WebAuthn 要求必须使用 HTTPS
- **开发环境**: localhost 可以使用 HTTP

### 4. 子域名支持
如果你有多个子域名需要支持 passkey：
```env
# 主域名
RP_ID=yourdomain.com

# 可以支持所有子域名
# 如: app.yourdomain.com, admin.yourdomain.com
```

## 部署步骤

### 1. 后端部署
1. 复制 `env.production.example` 为 `.env`
2. 修改配置中的域名：
   ```env
   RP_ID=yourdomain.com
   RP_ORIGIN=https://yourdomain.com
   CORS_ORIGIN=https://yourdomain.com
   ```
3. 设置其他生产环境变量（数据库、JWT 密钥等）

### 2. 前端部署
1. 复制 `config.production.json` 为 `config.json`
2. 修改配置中的域名：
   ```json
   {
       "apiBaseUrl": "https://api.yourdomain.com",
       "passkey": {
           "rpId": "yourdomain.com",
           "rpOrigin": "https://yourdomain.com"
       }
   }
   ```
3. 构建和部署前端

### 3. 验证部署
1. 确保前端可以通过 HTTPS 访问
2. 测试 passkey 注册和登录功能
3. 检查浏览器开发者工具中的网络请求

## 常见问题

### 1. Origin 不匹配错误
```
Error: Unexpected registration response origin "https://wrongdomain.com", expected "https://yourdomain.com"
```
**解决方案**: 确保 RP_ORIGIN 与实际前端地址完全匹配

### 2. RP ID 不匹配错误
**解决方案**: 确保 RP_ID 是正确的域名，不包含协议和路径

### 3. HTTPS 要求错误
**解决方案**: 生产环境必须使用 HTTPS，确保 SSL 证书正确配置

### 4. CORS 错误
**解决方案**: 确保后端 CORS_ORIGIN 配置正确，允许前端域名访问

## 安全注意事项

1. **永远不要在客户端暴露敏感配置**
2. **生产环境必须使用 HTTPS**
3. **定期更新 JWT 密钥**
4. **监控 passkey 使用情况**
5. **备份用户的 passkey 数据**
