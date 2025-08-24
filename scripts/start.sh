#!/bin/bash

# Sorami Backend 启动脚本
# 用法: ./scripts/start.sh [dev|prod]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
APP_NAME="sorami-backend"
LOG_DIR="logs"
PID_FILE=".pid"

# 环境设置
ENV=${1:-dev}
if [ "$ENV" = "prod" ]; then
    export NODE_ENV=production
    echo -e "${GREEN}Starting in production mode${NC}"
else
    export NODE_ENV=development
    echo -e "${GREEN}Starting in development mode${NC}"
fi

# 检查依赖
check_dependencies() {
    echo "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js is not installed${NC}"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}npm is not installed${NC}"
        exit 1
    fi
    
    if [ ! -f "package.json" ]; then
        echo -e "${RED}package.json not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Dependencies check passed${NC}"
}

# 安装依赖
install_dependencies() {
    echo "Installing dependencies..."
    npm install
    echo -e "${GREEN}Dependencies installed${NC}"
}

# 创建必要的目录
create_directories() {
    echo "Creating necessary directories..."
    mkdir -p $LOG_DIR
    mkdir -p uploads
    echo -e "${GREEN}Directories created${NC}"
}

# 检查端口是否被占用
check_port() {
    local port=${PORT:-3000}
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}Port $port is already in use${NC}"
        echo "Killing existing process..."
        lsof -ti:$port | xargs kill -9
        sleep 2
    fi
}

# 启动应用
start_app() {
    echo "Starting $APP_NAME..."
    
    # 设置环境变量
    export PORT=${PORT:-3000}
    export OSS_PUBLIC_READ=${OSS_PUBLIC_READ:-true}
    export OSS_PROVIDER=${OSS_PROVIDER:-minio}
    export OSS_ENDPOINT=${OSS_ENDPOINT:-localhost}
    export OSS_PORT=${OSS_PORT:-9000}
    export OSS_ACCESS_KEY=${OSS_ACCESS_KEY:-admin}
    export OSS_SECRET_KEY=${OSS_SECRET_KEY:-admin123}
    export OSS_BUCKET=${OSS_BUCKET:-soramidev}
    export OSS_USE_SSL=${OSS_USE_SSL:-false}
    export OSS_REGION=${OSS_REGION:-us-east-1}
    export RP_ID=${RP_ID:-localhost}
    export RP_NAME=${RP_NAME:-Sorami}
    export RP_ORIGIN=${RP_ORIGIN:-http://localhost:5174}
    export CORS_ORIGIN=${CORS_ORIGIN:-http://localhost:5174}
    
    # 启动应用
    nohup npm start > "$LOG_DIR/app.log" 2>&1 &
    echo $! > $PID_FILE
    
    echo -e "${GREEN}$APP_NAME started with PID $(cat $PID_FILE)${NC}"
    echo "Logs are being written to $LOG_DIR/app.log"
    echo "Health check: http://localhost:$PORT/health"
}

# 主函数
main() {
    echo -e "${GREEN}=== Sorami Backend Startup Script ===${NC}"
    
    check_dependencies
    install_dependencies
    create_directories
    check_port
    start_app
    
    echo -e "${GREEN}=== Startup Complete ===${NC}"
    echo "To stop the server: ./scripts/stop.sh"
    echo "To view logs: tail -f $LOG_DIR/app.log"
}

# 运行主函数
main "$@"
