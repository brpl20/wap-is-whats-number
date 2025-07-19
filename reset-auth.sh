#!/bin/bash

# WhatsApp Web Authentication Reset Script
# This script deletes all authentication data to force a fresh QR code login
# Use this when you're having authentication issues

echo "=============================================="
echo "  WhatsApp Auth Reset Tool  "
echo "=============================================="
echo "This will delete ALL authentication data and force a new QR code."
echo "You will need to re-authenticate by scanning a new QR code."
echo "=============================================="
echo ""

# Ask for confirmation
read -p "Are you sure you want to continue? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Operation cancelled."
    exit 0
fi

echo "Stopping any running WhatsApp server instances..."
pkill -f "node simple-whatsapp-server.js" || true

echo "Removing authentication directories..."

# Remove .wwebjs_auth directory if it exists
if [ -d ".wwebjs_auth" ]; then
    echo "Removing .wwebjs_auth directory..."
    rm -rf .wwebjs_auth
fi

# Remove .wwebjs_cache directory if it exists
if [ -d ".wwebjs_cache" ]; then
    echo "Removing .wwebjs_cache directory..."
    rm -rf .wwebjs_cache
fi

# Remove sessions directory if it exists
if [ -d "sessions" ]; then
    echo "Removing sessions directory..."
    rm -rf sessions
fi

# Recreate empty directories
echo "Creating fresh authentication directories..."
mkdir -p .wwebjs_auth
mkdir -p sessions
chmod -R 755 .wwebjs_auth
chmod -R 755 sessions

echo "Authentication data has been reset."
echo "Run ./start-server.sh to start the server with a fresh QR code."
echo ""
