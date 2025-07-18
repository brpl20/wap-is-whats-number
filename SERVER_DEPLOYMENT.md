# Server Deployment Guide

This guide provides instructions for deploying the Unified API Service (WhatsApp Number Validation + CEP Checker) on a Linux server.

## Prerequisites

- Linux server (Ubuntu/Debian recommended)
- Node.js 14 or higher
- Google Chrome or Chromium browser
- Git

## Installation Steps

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/wap-is-whats-number.git
cd wap-is-whats-number
```

### 2. Install Dependencies

```bash
# Update package lists
sudo apt update

# Install Node.js if not already installed
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install required system dependencies for Puppeteer
sudo apt install -y \
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget

# Install Chrome (if not already installed)
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
rm google-chrome-stable_current_amd64.deb

# Install Node.js dependencies
npm install
```

### 3. Server Configuration Options

You can configure the server using command-line arguments with the start script:

```bash
# Start with default settings
./start.sh

# Start with only CEP validation (no WhatsApp)
./start.sh --no-whatsapp

# Start on a different port
./start.sh --port=3001

# Specify a custom Chrome path
./start.sh --chrome=/path/to/chrome
```

### 4. Running as a SystemD Service

To run the service in the background and start automatically on system boot:

```bash
# Copy the service file to systemd directory
sudo cp unified-api.service /etc/systemd/system/

# Edit the service file if needed (update user, group, paths)
sudo nano /etc/systemd/system/unified-api.service

# Enable and start the service
sudo systemctl enable unified-api
sudo systemctl start unified-api

# Check service status
sudo systemctl status unified-api
```

### 5. View Logs

```bash
# View service logs
sudo journalctl -u unified-api -f
```

### 6. WhatsApp Authentication

When starting the server with WhatsApp functionality enabled, you'll need to authenticate by scanning a QR code:

1. Check the logs to find the QR code:
   ```bash
   sudo journalctl -u unified-api -f
   ```

2. Scan the QR code with your WhatsApp app
   - Open WhatsApp on your phone
   - Tap Menu or Settings > WhatsApp Web
   - Scan the QR code displayed in the logs

3. After successful authentication, the server will save the session data and you won't need to scan the QR code again unless you log out or the session expires.

### 7. Troubleshooting

#### WhatsApp Initialization Issues

If the WhatsApp client fails to initialize:

1. Try running with only CEP functionality:
   ```bash
   ./start.sh --no-whatsapp
   ```

2. Check if Chrome is installed correctly:
   ```bash
   which google-chrome-stable
   google-chrome-stable --version
   ```

3. Increase available memory with a swap file:
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

#### Port Already in Use

If the port is already in use:

```bash
# Find what's using the port
sudo lsof -i :3000

# Kill the process
sudo kill <PID>

# Or start on a different port
./start.sh --port=3001
```

### 8. Setting up Nginx as a Reverse Proxy (Optional)

To make your API accessible via a domain name:

```bash
# Install Nginx
sudo apt install -y nginx

# Create a configuration file
sudo nano /etc/nginx/sites-available/unified-api

# Add the following configuration (replace with your domain)
# server {
#     listen 80;
#     server_name api.yourdomain.com;
#
#     location / {
#         proxy_pass http://localhost:3000;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_cache_bypass $http_upgrade;
#     }
# }

# Enable the configuration
sudo ln -s /etc/nginx/sites-available/unified-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## API Endpoints

Once deployed, the following endpoints will be available:

### WhatsApp API
- `http://your-server:3000/api/whatsapp/check` - Check if a single phone number is on WhatsApp
- `http://your-server:3000/api/whatsapp/check-batch` - Check multiple phone numbers
- `http://your-server:3000/api/whatsapp/status` - Check WhatsApp client status

### CEP API
- `http://your-server:3000/api/cep/validate-cep/01001000` - Validate a CEP (GET)
- `http://your-server:3000/api/cep/validate-cep` - Validate a CEP (POST)

### Documentation
- `http://your-server:3000/` - API documentation and status