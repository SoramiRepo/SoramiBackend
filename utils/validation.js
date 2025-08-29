import mongoose from 'mongoose';

/**
 * 验证MongoDB ObjectId是否有效
 * @param {string} id - 要验证的ID
 * @returns {boolean} - 是否有效
 */
export const validateObjectId = (id) => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * 验证邮箱格式
 * @param {string} email - 要验证的邮箱
 * @returns {boolean} - 是否有效
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 验证用户名格式
 * @param {string} username - 要验证的用户名
 * @returns {boolean} - 是否有效
 */
export const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return false;
  }
  
  // 用户名长度3-20个字符，只能包含字母、数字、下划线
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

/**
 * 验证密码强度
 * @param {string} password - 要验证的密码
 * @returns {boolean} - 是否有效
 */
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return false;
  }
  
  // 密码至少8个字符，包含大小写字母和数字
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

/**
 * 验证URL格式
 * @param {string} url - 要验证的URL
 * @returns {boolean} - 是否有效
 */
export const validateUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 验证文件类型
 * @param {string} filename - 文件名
 * @param {string[]} allowedTypes - 允许的文件类型扩展名
 * @returns {boolean} - 是否有效
 */
export const validateFileType = (filename, allowedTypes = []) => {
  if (!filename || typeof filename !== 'string') {
    return false;
  }
  
  if (allowedTypes.length === 0) {
    return true; // 如果没有限制，则允许所有类型
  }
  
  const extension = filename.split('.').pop()?.toLowerCase();
  return allowedTypes.includes(extension);
};

/**
 * 验证文件大小
 * @param {number} fileSize - 文件大小（字节）
 * @param {number} maxSize - 最大文件大小（字节）
 * @returns {boolean} - 是否有效
 */
export const validateFileSize = (fileSize, maxSize) => {
  if (typeof fileSize !== 'number' || fileSize < 0) {
    return false;
  }
  
  if (typeof maxSize !== 'number' || maxSize <= 0) {
    return false;
  }
  
  return fileSize <= maxSize;
};

/**
 * 验证分页参数
 * @param {number} page - 页码
 * @param {number} limit - 每页数量
 * @param {number} maxLimit - 最大每页数量
 * @returns {object} - 验证后的分页参数
 */
export const validatePagination = (page = 1, limit = 20, maxLimit = 100) => {
  const validatedPage = Math.max(1, parseInt(page) || 1);
  const validatedLimit = Math.min(maxLimit, Math.max(1, parseInt(limit) || 20));
  
  return {
    page: validatedPage,
    limit: validatedLimit,
    skip: (validatedPage - 1) * validatedLimit
  };
};

/**
 * 清理和验证搜索查询
 * @param {string} query - 搜索查询
 * @param {number} maxLength - 最大长度
 * @returns {string|null} - 清理后的查询或null
 */
export const validateSearchQuery = (query, maxLength = 100) => {
  if (!query || typeof query !== 'string') {
    return null;
  }
  
  const cleanedQuery = query.trim();
  
  if (cleanedQuery.length === 0 || cleanedQuery.length > maxLength) {
    return null;
  }
  
  return cleanedQuery;
};

/**
 * 验证日期范围
 * @param {Date|string} startDate - 开始日期
 * @param {Date|string} endDate - 结束日期
 * @returns {boolean} - 是否有效
 */
export const validateDateRange = (startDate, endDate) => {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false;
    }
    
    return start <= end;
  } catch {
    return false;
  }
};

/**
 * 验证手机号格式（中国大陆）
 * @param {string} phone - 手机号
 * @returns {boolean} - 是否有效
 */
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
};

/**
 * 验证身份证号格式（中国大陆）
 * @param {string} idCard - 身份证号
 * @returns {boolean} - 是否有效
 */
export const validateIdCard = (idCard) => {
  if (!idCard || typeof idCard !== 'string') {
    return false;
  }
  
  const idCardRegex = /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/;
  return idCardRegex.test(idCard);
};
