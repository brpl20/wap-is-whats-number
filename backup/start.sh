#!/bin/bash

# Start script for the unified WhatsApp and CEP Validation server
# This script helps set environment variables and start the server

# Determine the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Default configuration
PORT=3000
DEFAULT_COUNTRY_CODE=55
MAX_BATCH_SIZE=20
OPERATION_TIMEOUT=30000
CHROME_PATH="/usr/bin/google-chrome-stable"
ENABLE_WHATSAPP="true"

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Display banner
echo -e "${BLUE}"
echo "=============================================="
echo "  WhatsApp & CEP Validation Server Starter   "
echo "=============================================="
echo -e "${NC}"

# Process command line arguments
for arg in "$@"
do
    case $arg in
        --no-whatsapp)
        ENABLE_WHATSAPP="false"
        echo -e "${YELLOW}WhatsApp functionality will be disabled${NC}"
        shift
        ;;
        --port=*)
        PORT="${arg#*=}"
        echo -e "${GREEN}Using port: $PORT${NC}"
        shift
        ;;
        --chrome=*)
        CHROME_PATH="${arg#*=}"
        echo -e "${GREEN}Using Chrome path: $CHROME_PATH${NC}"
        shift
        ;;
        --help)
        echo -e "${GREEN}Usage: $0 [options]${NC}"
        echo "Options:"
        echo "  --no-whatsapp     Disable WhatsApp functionality"
        echo "  --port=NUMBER     Set the server port (default: 3000)"
        echo "  --chrome=PATH     Set the Chrome executable path"
        echo "  --help            Show this help message"
        exit 0
        ;;
    esac
done

# Check if Chrome exists
if [ "$ENABLE_WHATSAPP" = "true" ]; then
    if [ ! -f "$CHROME_PATH" ]; then
        echo -e "${YELLOW}Warning: Chrome not found at $CHROME_PATH${NC}"
        echo -e "${YELLOW}Trying alternative locations...${NC}"

        # Try to find Chrome in common locations
        ALTERNATIVE_PATHS=(
            "/usr/bin/google-chrome"
            "/usr/bin/chromium"
            "/usr/bin/chromium-browser"
            "/snap/bin/chromium"
        )

        for path in "${ALTERNATIVE_PATHS[@]}"; do
            if [ -f "$path" ]; then
                CHROME_PATH="$path"
                echo -e "${GREEN}Found Chrome at: $CHROME_PATH${NC}"
                break
            fi
        done

        if [ ! -f "$CHROME_PATH" ]; then
            echo -e "${RED}No Chrome installation found. Disabling WhatsApp functionality.${NC}"
            ENABLE_WHATSAPP="false"
        fi
    else
        echo -e "${GREEN}Chrome found at: $CHROME_PATH${NC}"
    fi
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js before continuing"
    exit 1
fi

# Check if necessary directories exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Set environment variables
export PORT="$PORT"
export DEFAULT_COUNTRY_CODE="$DEFAULT_COUNTRY_CODE"
export MAX_BATCH_SIZE="$MAX_BATCH_SIZE"
export OPERATION_TIMEOUT="$OPERATION_TIMEOUT"
export CHROME_PATH="$CHROME_PATH"
export ENABLE_WHATSAPP="$ENABLE_WHATSAPP"

echo -e "${GREEN}Starting server with configuration:${NC}"
echo "- Port: $PORT"
echo "- WhatsApp Enabled: $ENABLE_WHATSAPP"
echo "- Chrome Path: $CHROME_PATH"
echo "- Default Country Code: $DEFAULT_COUNTRY_CODE"
echo "- Max Batch Size: $MAX_BATCH_SIZE"
echo "- Operation Timeout: $OPERATION_TIMEOUT ms"
echo -e "${BLUE}=============================================${NC}"

# Start the server
node server.js

# If server crashes, display error message
if [ $? -ne 0 ]; then
    echo -e "${RED}Server crashed or failed to start${NC}"
    echo "Check logs for more information"
    exit 1
fi
