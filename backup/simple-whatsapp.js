const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Create a simple WhatsApp client
const client = new Client({
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
    ],
  }
});

// Event handler for QR code
client.on('qr', (qr) => {
  console.log('QR Code received. Scan with your phone:');
  qrcode.generate(qr, { small: true });
});

// Event handler for when client is ready
client.on('ready', () => {
  console.log('WhatsApp client is ready! Hello World!');
});

// Event handler for messages
client.on('message', async (msg) => {
  console.log(`Message received: ${msg.body}`);

  // Respond to specific commands
  if (msg.body.toLowerCase() === 'hello') {
    msg.reply('Hello World!');
  }

  if (msg.body.toLowerCase() === 'ping') {
    msg.reply('pong');
  }
});

// Initialize the client
console.log('Starting WhatsApp client...');
client.initialize().catch(err => {
  console.error('Failed to initialize WhatsApp client:', err);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  if (client) {
    await client.destroy();
  }
  process.exit(0);
});
