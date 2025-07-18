#!/bin/bash

# Simple start script for WhatsApp Number Checker API
# This script starts the simplified WhatsApp server with minimal configuration

# Display banner
echo "=============================================="
echo "  WhatsApp Number Checker API - Simple Start  "
echo "=============================================="

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed!"
    echo "Please install Node.js before continuing."
    exit 1
fi

# Set default port
PORT=${PORT:-3000}

# Process command line arguments
for arg in "$@"
do
    case $arg in
        --port=*)
        PORT="${arg#*=}"
        shift
        ;;
        --help)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --port=NUMBER     Set the server port (default: 3000)"
        echo "  --help            Show this help message"
        exit 0
        ;;
    esac
done

# Check if dependencies are installed
if [ ! -d "node_modules/whatsapp-web.js" ]; then
    echo "Installing required dependencies..."
    npm install
fi

# Export environment variables
export PORT="$PORT"
export DEFAULT_COUNTRY_CODE="55"
export MAX_BATCH_SIZE="20"

echo "Starting WhatsApp Number Checker API on port $PORT..."
echo "Press Ctrl+C to stop the server"

# Run the server
node simple-whatsapp-server.js
