import chalk from 'chalk';
import util from 'util';

// ANSI 颜色代码
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    
    // 背景色
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m'
};

// 日志级别配置
const LOG_LEVELS = {
    ERROR: { level: 0, color: 'red', emoji: '❌', label: 'ERROR' },
    WARN: { level: 1, color: 'yellow', emoji: '⚠️', label: 'WARN' },
    INFO: { level: 2, color: 'blue', emoji: 'ℹ️', label: 'INFO' },
    SUCCESS: { level: 3, color: 'green', emoji: '✅', label: 'SUCCESS' },
    DEBUG: { level: 4, color: 'gray', emoji: '🔍', label: 'DEBUG' },
    TRACE: { level: 5, color: 'magenta', emoji: '🔬', label: 'TRACE' }
};

class Logger {
    constructor(options = {}) {
        this.level = options.level || 'INFO';
        this.enableColors = options.enableColors !== false;
        this.enableEmojis = options.enableEmojis !== false;
        this.enableTimestamp = options.enableTimestamp !== false;
        this.prefix = options.prefix || '';
    }

    // 获取时间戳
    getTimestamp() {
        if (!this.enableTimestamp) return '';
        const now = new Date();
        const time = now.toLocaleTimeString('zh-CN', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Shanghai'
        });
        const ms = now.getMilliseconds().toString().padStart(3, '0');
        return this.enableColors 
            ? colors.gray + `[${time}.${ms}]` + colors.reset
            : `[${time}.${ms}]`;
    }

    // 格式化消息
    formatMessage(level, message, data = null) {
        const config = LOG_LEVELS[level];
        const timestamp = this.getTimestamp();
        const emoji = this.enableEmojis ? config.emoji + ' ' : '';
        const prefix = this.prefix ? `[${this.prefix}] ` : '';
        
        let formattedMessage;
        if (this.enableColors) {
            const levelLabel = colors[config.color] + colors.bright + config.label + colors.reset;
            formattedMessage = `${timestamp} ${emoji}${levelLabel} ${prefix}${message}`;
        } else {
            formattedMessage = `${timestamp} ${emoji}${config.label} ${prefix}${message}`;
        }

        if (data !== null) {
            const formattedData = typeof data === 'object' 
                ? util.inspect(data, { colors: this.enableColors, depth: 3, compact: false })
                : String(data);
            formattedMessage += '\n' + formattedData;
        }

        return formattedMessage;
    }

    // 检查是否应该记录此级别的日志
    shouldLog(level) {
        const currentLevel = LOG_LEVELS[this.level]?.level ?? LOG_LEVELS.INFO.level;
        const messageLevel = LOG_LEVELS[level]?.level ?? LOG_LEVELS.INFO.level;
        return messageLevel <= currentLevel;
    }

    // 基础日志方法
    log(level, message, data = null) {
        if (!this.shouldLog(level)) return;
        
        const formattedMessage = this.formatMessage(level, message, data);
        
        if (level === 'ERROR') {
            console.error(formattedMessage);
        } else {
            console.log(formattedMessage);
        }
    }

    // 便捷方法
    error(message, data = null) {
        this.log('ERROR', message, data);
    }

    warn(message, data = null) {
        this.log('WARN', message, data);
    }

    info(message, data = null) {
        this.log('INFO', message, data);
    }

    success(message, data = null) {
        this.log('SUCCESS', message, data);
    }

    debug(message, data = null) {
        this.log('DEBUG', message, data);
    }

    trace(message, data = null) {
        this.log('TRACE', message, data);
    }

    // 特殊格式的日志方法
    server(message, port = null) {
        const portInfo = port ? ` on port ${colors.cyan}${port}${colors.reset}` : '';
        if (this.enableColors) {
            console.log(`${this.getTimestamp()} ${colors.green}${colors.bright}🚀 SERVER${colors.reset} ${message}${portInfo}`);
        } else {
            console.log(`${this.getTimestamp()} 🚀 SERVER ${message}${portInfo ? ` on port ${port}` : ''}`);
        }
    }

    database(message, status = 'success') {
        const emoji = status === 'success' ? '🗄️' : '❌';
        const color = status === 'success' ? 'green' : 'red';
        if (this.enableColors) {
            console.log(`${this.getTimestamp()} ${colors[color]}${colors.bright}${emoji} DATABASE${colors.reset} ${message}`);
        } else {
            console.log(`${this.getTimestamp()} ${emoji} DATABASE ${message}`);
        }
    }

    request(method, url, status, responseTime = null) {
        const statusColor = this.getStatusColor(status);
        const methodFormatted = this.enableColors 
            ? colors.bright + method.padEnd(6) + colors.reset
            : method.padEnd(6);
        const statusFormatted = this.enableColors
            ? colors[statusColor] + status + colors.reset
            : status;
        const timeInfo = responseTime ? ` ${colors.gray}${responseTime}ms${colors.reset}` : '';
        
        if (this.enableColors) {
            console.log(`${this.getTimestamp()} ${colors.cyan}📡 HTTP${colors.reset} ${methodFormatted} ${url} ${statusFormatted}${timeInfo}`);
        } else {
            console.log(`${this.getTimestamp()} 📡 HTTP ${methodFormatted} ${url} ${status}${responseTime ? ` ${responseTime}ms` : ''}`);
        }
    }

    auth(message, username = null) {
        const userInfo = username ? ` [${colors.yellow}${username}${colors.reset}]` : '';
        if (this.enableColors) {
            console.log(`${this.getTimestamp()} ${colors.blue}${colors.bright}🔐 AUTH${colors.reset} ${message}${userInfo}`);
        } else {
            console.log(`${this.getTimestamp()} 🔐 AUTH ${message}${username ? ` [${username}]` : ''}`);
        }
    }

    websocket(message, userId = null) {
        const userInfo = userId ? ` [${colors.magenta}${userId}${colors.reset}]` : '';
        if (this.enableColors) {
            console.log(`${this.getTimestamp()} ${colors.magenta}${colors.bright}🔌 WS${colors.reset} ${message}${userInfo}`);
        } else {
            console.log(`${this.getTimestamp()} 🔌 WS ${message}${userId ? ` [${userId}]` : ''}`);
        }
    }

    file(message, filename = null) {
        const fileInfo = filename ? ` [${colors.cyan}${filename}${colors.reset}]` : '';
        if (this.enableColors) {
            console.log(`${this.getTimestamp()} ${colors.blue}${colors.bright}📁 FILE${colors.reset} ${message}${fileInfo}`);
        } else {
            console.log(`${this.getTimestamp()} 📁 FILE ${message}${filename ? ` [${filename}]` : ''}`);
        }
    }

    // 获取 HTTP 状态码对应的颜色
    getStatusColor(status) {
        if (status >= 200 && status < 300) return 'green';
        if (status >= 300 && status < 400) return 'cyan';
        if (status >= 400 && status < 500) return 'yellow';
        if (status >= 500) return 'red';
        return 'white';
    }

    // 创建子 logger
    child(prefix) {
        return new Logger({
            level: this.level,
            enableColors: this.enableColors,
            enableEmojis: this.enableEmojis,
            enableTimestamp: this.enableTimestamp,
            prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix
        });
    }

    // 分隔线
    separator(char = '─', length = 50) {
        const line = char.repeat(length);
        if (this.enableColors) {
            console.log(colors.gray + line + colors.reset);
        } else {
            console.log(line);
        }
    }

    // 标题
    title(message) {
        this.separator('═');
        if (this.enableColors) {
            console.log(colors.cyan + colors.bright + '  ' + message + colors.reset);
        } else {
            console.log('  ' + message);
        }
        this.separator('═');
    }

    // 启动横幅
    banner(appName, version, environment = 'development') {
        const envColor = environment === 'production' ? 'red' : 'green';
        
        if (this.enableColors) {
            console.log('\n' + colors.cyan + colors.bright + '╔══════════════════════════════════════════════════════════════╗' + colors.reset);
            console.log(colors.cyan + colors.bright + '║' + colors.reset + '                                                              ' + colors.cyan + colors.bright + '║' + colors.reset);
            console.log(colors.cyan + colors.bright + '║' + colors.reset + '  🚀 ' + colors.blue + colors.bright + appName.padEnd(20) + colors.reset + colors.green + ('v' + version).padEnd(10) + colors.reset + colors[envColor] + environment.padEnd(20) + colors.reset + colors.cyan + colors.bright + '║' + colors.reset);
            console.log(colors.cyan + colors.bright + '║' + colors.reset + '                                                              ' + colors.cyan + colors.bright + '║' + colors.reset);
            console.log(colors.cyan + colors.bright + '╚══════════════════════════════════════════════════════════════╝' + colors.reset + '\n');
        } else {
            console.log('\n╔══════════════════════════════════════════════════════════════╗');
            console.log('║                                                              ║');
            console.log(`║  🚀 ${appName.padEnd(20)} v${version.padEnd(9)} ${environment.padEnd(20)} ║`);
            console.log('║                                                              ║');
            console.log('╚══════════════════════════════════════════════════════════════╝\n');
        }
    }
}

// 创建默认 logger 实例
const logger = new Logger({
    level: process.env.LOG_LEVEL || 'INFO',
    enableColors: process.env.NO_COLOR !== 'true',
    enableEmojis: process.env.NO_EMOJI !== 'true',
    enableTimestamp: process.env.NO_TIMESTAMP !== 'true'
});

export default logger;
export { Logger };
