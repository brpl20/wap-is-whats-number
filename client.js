const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const path = require("path");
const fs = require("fs");

async function initializeWhatsAppClient() {
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: "wap-is-whats-number", // Unique identifier for this client
      dataPath: "./sessions", // This will create the auth folder here
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

  client.on("qr", (qr) => {
    console.log("QR RECEIVED. Scan this with your WhatsApp app:");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("WhatsApp client is ready!");
  });

  client.on("authenticated", () => {
    console.log("WhatsApp client authenticated");
  });

  client.on("auth_failure", (msg) => {
    console.error("WhatsApp authentication failed:", msg);
  });

  client.initialize();
  return client;
}

module.exports = { initializeWhatsAppClient };
