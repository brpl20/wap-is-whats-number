const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const path = require("path");
const fs = require("fs");

async function initializeWhatsAppClient() {
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: "wap-is-whats-number", // Unique identifier for this client
      dataPath: path.join(__dirname, "./sessions"), // Use absolute path to ensure correct location
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    },
  });

  // Handle QR code generation
  client.on("qr", (qr) => {
    console.log("QR RECEIVED. Scan this with your WhatsApp app:");
    qrcode.generate(qr, { small: true });
  });

  // Handle client ready event
  client.on("ready", () => {
    console.log("WhatsApp client is ready!");
  });

  // Handle authentication
  client.on("authenticated", () => {
    console.log("WhatsApp client authenticated");
  });

  // Handle authentication failures
  client.on("auth_failure", (msg) => {
    console.error("WhatsApp authentication failed:", msg);
  });

  client.initialize();

  return client;
}

module.exports = { initializeWhatsAppClient };
