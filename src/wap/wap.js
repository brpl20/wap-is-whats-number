const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const path = require("path");
const { config } = require('./wap_config');
const { formatPhoneNumber } = require('./wap_format_phone_number');
const { checkWhatsAppNumber } = require('./wap_check_whatsapp_number');

class WhatsAppFacade {
  constructor() {
    this.client = null;
    this.isReady = false;
  }

  initializeClient(options = {}) {
    const defaultOptions = {
      authStrategy: new LocalAuth({
        clientId: options.clientId || "wap-is-whats-number",
        dataPath: path.join(__dirname, "../sessions"),
      }),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      },
    };

    this.client = new Client({ ...defaultOptions, ...options });

    this.client.on("qr", (qr) => {
      console.log("QR RECEIVED. Scan this with your WhatsApp app:");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () => {
      console.log("WhatsApp client is ready!");
      this.isReady = true;
    });

    this.client.on("authenticated", () => {
      console.log("WhatsApp client authenticated");
    });

    this.client.on("auth_failure", (msg) => {
      console.error("WhatsApp authentication failed:", msg);
      this.isReady = false;
    });

    this.client.on("disconnected", (reason) => {
      console.log("Client was logged out", reason);
      this.isReady = false;
    });

    this.client.initialize();
    
    return this.client;
  }

  getClient() {
    return this.client;
  }

  isClientReady() {
    return this.isReady && this.client && this.client.info;
  }

  formatPhoneNumber(phoneNumber, countryCode) {
    return formatPhoneNumber(phoneNumber, countryCode);
  }

  async checkWhatsAppNumber(phoneNumber, countryCode) {
    if (!this.isClientReady()) {
      throw new Error("WhatsApp client not ready. Please wait for initialization.");
    }
    return checkWhatsAppNumber(phoneNumber, countryCode, this.client);
  }

  async destroy() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.isReady = false;
    }
  }

  ensureClientReady() {
    return (req, res, next) => {
      if (!this.isClientReady()) {
        return res.status(503).json({
          success: false,
          error: "WhatsApp client not ready yet. Please try again later.",
        });
      }
      next();
    };
  }

  getConfig() {
    return config;
  }
}

// Create singleton instance
const wapFacade = new WhatsAppFacade();

module.exports = wapFacade;