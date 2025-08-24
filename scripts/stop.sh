#!/bin/bash

# Sorami Backend 停止脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
APP_NAME="sorami-backend"
PID_FILE=".pid"
LOG_DIR="logs"

# 停止应用
stop_app() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat $PID_FILE)
        
        if ps -p $pid > /dev/null 2>&1; then
            echo "Stopping $APP_NAME (PID: $pid)..."
            
            # 发送 SIGTERM 信号
            kill -TERM $pid
            
            # 等待进程优雅关闭
            local count=0
            while ps -p $pid > /dev/null 2>&1 && [ $count -lt 10 ]; do
                echo "Waiting for process to stop... ($count/10)"
                sleep 1
                count=$((count + 1))
            done
            
            # 如果进程仍然存在，强制杀死
            if ps -p $pid > /dev/null 2>&1; then
                echo -e "${YELLOW}Process still running, force killing...${NC}"
                kill -KILL $pid
                sleep 1
            fi
            
            # 检查进程是否已停止
            if ! ps -p $pid > /dev/null 2>&1; then
                echo -e "${GREEN}$APP_NAME stopped successfully${NC}"
                rm -f $PID_FILE
            else
                echo -e "${RED}Failed to stop $APP_NAME${NC}"
                exit 1
            fi
        else
            echo -e "${YELLOW}Process with PID $pid not found${NC}"
            rm -f $PID_FILE
        fi
    else
        echo -e "${YELLOW}PID file not found${NC}"
        
        # 尝试通过进程名查找并停止
        local pids=$(pgrep -f "node server.js" || true)
        if [ -n "$pids" ]; then
            echo "Found running processes: $pids"
            echo "Stopping all node server.js processes..."
            pkill -f "node server.js"
            sleep 2
            echo -e "${GREEN}All processes stopped${NC}"
        else
            echo "No running processes found"
        fi
    fi
}

# 清理临时文件
cleanup() {
    echo "Cleaning up temporary files..."
    
    # 删除 PID 文件
    rm -f $PID_FILE
    
    # 清理日志文件（保留最近7天的）
    if [ -d "$LOG_DIR" ]; then
        echo "Cleaning old log files..."
        find $LOG_DIR -name "*.log" -mtime +7 -delete 2>/dev/null || true
    fi
    
    echo -e "${GREEN}Cleanup completed${NC}"
}

# 主函数
main() {
    echo -e "${GREEN}=== Sorami Backend Stop Script ===${NC}"
    
    stop_app
    cleanup
    
    echo -e "${GREEN}=== Stop Complete ===${NC}"
}

# 运行主函数
main "$@"
