const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

// Initialize Express app
const app = express();
app.use(express.json({ limit: "1mb" }));

// Request logging middleware with timestamp
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`
    );
  });
  next();
});

// Add CORS support for cross-origin requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    return res.status(200).json({});
  }
  next();
});

// Configuration options from environment or defaults
const config = {
  port: process.env.PORT || 3000,
  sslEnabled: process.env.SSL_ENABLED === "true",
  sslKey: process.env.SSL_KEY || path.join(__dirname, "certs", "key.pem"),
  sslCert: process.env.SSL_CERT || path.join(__dirname, "certs", "cert.pem"),
  puppeteerArgs: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--window-size=1280,720",
  ],
  chromeExecutablePath: process.env.CHROME_PATH ||
    (process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "/usr/bin/google-chrome"),
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || "55",
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || "20", 10),
  operationTimeout: parseInt(process.env.OPERATION_TIMEOUT || "10000", 10),
};

// Create data directory for persistent storage
const dataDir = path.join(__dirname, ".wwebjs_auth");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Log environment and configuration
console.log(`Server starting with the following configuration:`);
console.log(`- Node.js: ${process.version}`);
console.log(`- Platform: ${process.platform}`);
console.log(`- Port: ${config.port}`);
console.log(`- SSL Enabled: ${config.sslEnabled}`);
console.log(`- Chrome Path: ${config.chromeExecutablePath}`);
console.log(`- Default Country Code: ${config.defaultCountryCode}`);
console.log(`- Max Batch Size: ${config.maxBatchSize}`);

// Initialize the WhatsApp client with proper configuration for server environment
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: dataDir,
  }),
  puppeteer: {
    headless: true,
    executablePath: config.chromeExecutablePath,
    args: config.puppeteerArgs,
    timeout: 120000,
    ignoreHTTPSErrors: true,
    defaultViewport: {
      width: 1280,
      height: 720,
    },
  },
  webVersionCache: {
    type: "local",
  },
  webVersion: "2.2409.2",
});

// Set up client event handlers
client.on("ready", () => {
  console.log("WhatsApp Web client is ready and authenticated");
  console.log(`Connected as: ${client.info.pushname} (${client.info.wid.user})`);
  console.log("API is now available for use");
});

client.on("error", (error) => {
  console.error("WhatsApp client error:", error);
});

client.on("disconnected", (reason) => {
  console.log("WhatsApp client disconnected:", reason);
  // Attempt to reconnect after delay
  setTimeout(() => {
    console.log("Attempting to reconnect...");
    client
      .initialize()
      .catch((err) => console.error("Failed to reinitialize client:", err));
  }, 5000);
});

client.on("qr", (qr) => {
  console.log("\n" + "=".repeat(50));
  console.log("QR CODE RECEIVED - SCAN WITH YOUR WHATSAPP APP");
  console.log("=".repeat(50));

  // Generate QR code in terminal
  qrcode.generate(qr, { small: true });

  // Save QR code to file for server environments without terminal access
  const qrCodePath = path.join(__dirname, "whatsapp-qr.txt");
  fs.writeFileSync(qrCodePath, qr);
  console.log(`QR code also saved to: ${qrCodePath}`);

  console.log("=".repeat(50) + "\n");
});

client.on("auth_failure", (msg) => {
  console.error("Authentication failed:", msg);
});

// Health check endpoint that doesn't require authentication
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "up",
    timestamp: new Date().toISOString(),
    version: require("./package.json").version,
  });
});

/**
 * Formats a phone number for WhatsApp API
 *
 * @param {string} phone - The phone number to format
 * @param {string} countryCode - The default country code to use
 * @returns {string} Formatted phone number or "N/A" if invalid
 */
function formatPhoneForWhatsApp(phone, countryCode = config.defaultCountryCode) {
  if (!phone) return "N/A";

  // First clean the phone number of non-digits
  const cleanPhone = phone.toString().replace(/\D/g, "");

  // If number already has country code, don't add it again
  if (cleanPhone.startsWith(countryCode)) {
    return `${cleanPhone}@c.us`;
  }

  // Check if it's a valid length for a phone number
  // Most countries have phone numbers between 8 and 15 digits
  if (cleanPhone.length < 8 || cleanPhone.length > 15) {
    console.warn(`Invalid phone number length: ${cleanPhone}`);
    return "N/A";
  }

  return `${countryCode}${cleanPhone}@c.us`;
}

/**
 * Check if a WhatsApp contact is registered
 *
 * @param {string} whatsappId - WhatsApp ID in format "XXXXXXXXXXX@c.us"
 * @returns {Promise<boolean>} Whether the number is registered
 */
async function checkWhatsAppContact(whatsappId) {
  // Skip invalid numbers
  if (!whatsappId || whatsappId === "N/A") {
    return false;
  }

  try {
    // Set timeout for operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Operation timed out")), config.operationTimeout);
    });

    // Check if user is registered
    const resultPromise = client.isRegisteredUser(whatsappId);

    // Race between the operation and the timeout
    return await Promise.race([resultPromise, timeoutPromise]);
  } catch (error) {
    console.error(`Error checking contact ${whatsappId}:`, error.message);
    return false;
  }
}

/**
 * Middleware to ensure WhatsApp client is ready
 */
function ensureClientReady(req, res, next) {
  if (!client || !client.info) {
    return res.status(503).json({
      error: "WhatsApp client not ready yet. Please scan the QR code and try again.",
      status: "client_not_ready",
    });
  }
  next();
}

// Apply client ready middleware to relevant endpoints
app.use(["/api/check", "/api/check-batch"], ensureClientReady);

// Endpoint to check if a single phone number is registered on WhatsApp
app.post("/api/check", async (req, res) => {
  const { phoneNumber, countryCode } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required." });
  }

  try {
    const whatsappId = formatPhoneForWhatsApp(phoneNumber, countryCode);

    if (whatsappId === "N/A") {
      return res.json({
        phoneNumber,
        formattedNumber: whatsappId,
        isValidWhatsApp: false,
      });
    }

    const isValidWhatsApp = await checkWhatsAppContact(whatsappId);

    res.json({
      phoneNumber,
      formattedNumber: whatsappId,
      isValidWhatsApp,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /api/check:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Endpoint to check if multiple phone numbers are registered on WhatsApp
app.post("/api/check-batch", async (req, res) => {
  const { phoneNumbers, countryCode } = req.body;

  if (!Array.isArray(phoneNumbers)) {
    return res
      .status(400)
      .json({ error: "Invalid input, expected an array of phone numbers." });
  }

  if (phoneNumbers.length > 1000) {
    return res
      .status(400)
      .json({ error: "Too many phone numbers. Maximum is 1000 per request." });
  }

  try {
    // Process in batches to avoid overwhelming the WhatsApp API
    const BATCH_SIZE = config.maxBatchSize;
    let results = [];

    for (let i = 0; i < phoneNumbers.length; i += BATCH_SIZE) {
      const batch = phoneNumbers.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${i/BATCH_SIZE + 1}/${Math.ceil(phoneNumbers.length/BATCH_SIZE)}: ${batch.length} numbers`);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (phone) => {
          const whatsappId = formatPhoneForWhatsApp(phone, countryCode);

          if (whatsappId === "N/A") {
            return {
              phone,
              formattedNumber: whatsappId,
              isValidWhatsApp: false,
            };
          }

          const isValidWhatsApp = await checkWhatsAppContact(whatsappId);

          return {
            phone,
            formattedNumber: whatsappId,
            isValidWhatsApp,
          };
        })
      );

      results = [...results, ...batchResults];
    }

    res.json({
      results,
      total: results.length,
      validCount: results.filter(r => r.isValidWhatsApp).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /api/check-batch:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Endpoint to check the API status and health
app.get("/api/status", async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({
        success: false,
        status: "Client not initialized",
      });
    }

    const state = await client.getState();
    const info = client.info || {};

    res.status(200).json({
      success: true,
      status: state,
      clientInfo: {
        name: info.pushname,
        phone: info.wid ? info.wid.user : null,
        connected: !!state,
      },
      server: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Basic documentation endpoint
app.get("/", (req, res) => {
  const clientReady = client && client.info;

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>WhatsApp Number Validation API</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #075e54; }
          h2 { color: #128c7e; }
          code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
          .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
          .ready { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .not-ready { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; }
        </style>
      </head>
      <body>
        <h1>WhatsApp Number Validation API</h1>
        <p>This API checks if phone numbers are registered on WhatsApp.</p>

        <div class="${clientReady ? "status ready" : "status not-ready"}">
          <strong>Status:</strong> ${clientReady ? "Ready - WhatsApp Web client connected" : "Waiting for QR Code scan..."}
        </div>

        <h2>API Endpoints:</h2>
        <table>
          <tr>
            <th>Endpoint</th>
            <th>Method</th>
            <th>Description</th>
          </tr>
          <tr>
            <td><code>/api/check</code></td>
            <td>POST</td>
            <td>Check a single phone number</td>
          </tr>
          <tr>
            <td><code>/api/check-batch</code></td>
            <td>POST</td>
            <td>Check multiple phone numbers (up to 1000)</td>
          </tr>
          <tr>
            <td><code>/api/status</code></td>
            <td>GET</td>
            <td>Check API health and connection status</td>
          </tr>
          <tr>
            <td><code>/health</code></td>
            <td>GET</td>
            <td>Basic server health check</td>
          </tr>
        </table>

        <h2>Example Usage:</h2>
        <pre>
// Single phone check
POST /api/check
{
  "phoneNumber": "11987654321",
  "countryCode": "55"  // Optional
}

// Multiple phone check
POST /api/check-batch
{
  "phoneNumbers": ["11987654321", "1187654321", "(11) 98765-4321"],
  "countryCode": "55"  // Optional
}
        </pre>

        <h2>Server Configuration:</h2>
        <ul>
          <li><strong>Port:</strong> ${config.port}</li>
          <li><strong>SSL:</strong> ${config.sslEnabled ? "Enabled" : "Disabled"}</li>
          <li><strong>Default Country Code:</strong> ${config.defaultCountryCode}</li>
          <li><strong>Max Batch Size:</strong> ${config.maxBatchSize}</li>
          <li><strong>Platform:</strong> ${process.platform}</li>
          <li><strong>Node.js:</strong> ${process.version}</li>
        </ul>

        <h2>Setup Instructions:</h2>
        <ol>
          <li>Start the server</li>
          <li>Scan the QR code that appears in the terminal with WhatsApp on your phone</li>
          <li>Once connected, you can use the API endpoints</li>
        </ol>
      </body>
    </html>
  `);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// Initialize the client with better error handling
console.log("Initializing WhatsApp Web client...");

// Create server based on SSL configuration
let server;

if (config.sslEnabled) {
  try {
    const sslOptions = {
      key: fs.readFileSync(config.sslKey),
      cert: fs.readFileSync(config.sslCert),
    };
    server = https.createServer(sslOptions, app);
    console.log("SSL enabled: Using HTTPS server");
  } catch (error) {
    console.error("Error loading SSL certificates:", error);
    console.log("Falling back to HTTP server");
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
  console.log("SSL disabled: Using HTTP server");
}

// Start the server
server.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
  console.log(`API documentation available at http://localhost:${config.port}/`);

  // Delay initialization to ensure server is fully ready
  setTimeout(() => {
    console.log("Starting WhatsApp Web client initialization...");
    client.initialize().catch((err) => {
      console.error("Failed to initialize WhatsApp client:", err);
      console.error("Stack trace:", err.stack);

      // Provide helpful error messages based on common issues
      if (err.message.includes("spawn")) {
        console.error("\n" + "!".repeat(60));
        console.error("CHROME SPAWN ERROR DETECTED!");
        console.error("Possible solutions:");
        console.error("1. Check Chrome installation path: " + config.chromeExecutablePath);
        console.error("2. Install Chrome if not present");
        console.error("3. Set CHROME_PATH environment variable to your Chrome executable");
        console.error("!".repeat(60) + "\n");
      } else if (err.message.includes("Session closed")) {
        console.error("\n" + "!".repeat(60));
        console.error("CHROME SESSION CLOSED UNEXPECTEDLY!");
        console.error("Possible solutions:");
        console.error("1. Make sure you have enough system resources (RAM, CPU)");
        console.error("2. Check if Chrome has proper permissions");
        console.error("3. Try updating Chrome to latest version");
        console.error("!".repeat(60) + "\n");
      }

      // Don't exit immediately, allow the server to continue running
      console.log(
        "WhatsApp client initialization failed, but server continues running.",
      );
      console.log(
        "You can try restarting the application or accessing /api/status to check server health.",
      );
    });
  }, 3000);
});

// Handle graceful shutdown
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  shutdown();
});

async function shutdown() {
  console.log("\nGracefully shutting down...");
  try {
    if (client) {
      console.log("Closing WhatsApp client connection...");
      await client.destroy();
    }

    server.close(() => {
      console.log("HTTP server closed");
      console.log("Shutdown complete");
      process.exit(0);
    });
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}
