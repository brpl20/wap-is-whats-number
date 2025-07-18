#!/bin/bash

# Simple script to start the basic WhatsApp client
# This script contains minimal configuration and is designed to work on most systems

# Display a simple banner
echo "======================================"
echo "  Starting Simple WhatsApp Client"
echo "======================================"

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed!"
    echo "Please install Node.js before continuing."
    exit 1
fi

# Check if the required packages are installed
if [ ! -d "node_modules/whatsapp-web.js" ] || [ ! -d "node_modules/qrcode-terminal" ]; then
    echo "Installing required packages..."
    npm install whatsapp-web.js qrcode-terminal
fi

# Try to detect Chrome location
CHROME_PATHS=(
    "/usr/bin/google-chrome-stable"
    "/usr/bin/google-chrome"
    "/usr/bin/chromium"
    "/usr/bin/chromium-browser"
)

for path in "${CHROME_PATHS[@]}"; do
    if [ -f "$path" ]; then
        export PUPPETEER_EXECUTABLE_PATH="$path"
        echo "Found Chrome at: $path"
        break
    fi
done

# If Chrome wasn't found, let Puppeteer download its own
if [ -z "$PUPPETEER_EXECUTABLE_PATH" ]; then
    echo "No Chrome installation found. Puppeteer will use its own Chromium."
fi

# Set NODE_OPTIONS to increase memory limit if needed
export NODE_OPTIONS="--max-old-space-size=512"

# Run the simple WhatsApp client
echo "Starting client... Scan the QR code when it appears"
node simple-whatsapp.js
