#!/bin/bash

# Unified API Startup Script

echo "🚀 Starting Unified API Server..."
echo "================================"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create necessary directories
mkdir -p logs
mkdir -p sessions

# Set environment variables (optional)
export PORT=${PORT:-3000}
export DEFAULT_COUNTRY_CODE=${DEFAULT_COUNTRY_CODE:-55}
export MAX_BATCH_SIZE=${MAX_BATCH_SIZE:-20}

echo "📋 Configuration:"
echo "  Port: $PORT"
echo "  Default Country Code: $DEFAULT_COUNTRY_CODE"
echo "  Max Batch Size: $MAX_BATCH_SIZE"
echo ""

# Start the server
echo "🔧 Starting server..."
node index.js