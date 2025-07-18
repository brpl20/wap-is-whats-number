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
});

// Set up client event listeners
client.on("qr", (qr) => {
  console.log("QR RECEIVED. Scan this with your WhatsApp app:");
  qrcode.generate(qr, { small: true });
  // Also save the QR code to a file for server-based access
  fs.writeFileSync(path.join(__dirname, "last_qr.txt"), qr);
});

client.on("ready", () => {
  console.log("WhatsApp client is ready!");
  console.log(`Client info: ${client.info.pushname} (${client.info.wid.user})`);
});

client.on("authenticated", () => {
  console.log("WhatsApp client authenticated");
});

client.on("auth_failure", (msg) => {
  console.error("WhatsApp authentication failed:", msg);
});

client.on("disconnected", (reason) => {
  console.log("WhatsApp client was disconnected:", reason);
  console.log("Attempting to reconnect...");
  client.initialize().catch((err) => {
    console.error("Failed to reinitialize after disconnect:", err);
  });
});

// Utility function to format phone numbers to WhatsApp format
function formatPhoneForWhatsApp(phoneNumber, countryCode = config.defaultCountryCode) {
  // Remove any non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, "");

  // Handle special cases
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // If the number already has the country code with a + prefix, use it as is
  if (phoneNumber.startsWith("+")) {
    return cleaned;
  }

  // If the number starts with the country code but no +, assume it's the country code
  if (cleaned.startsWith(countryCode)) {
    return cleaned;
  }

  // Otherwise, prepend the country code
  return countryCode + cleaned;
}

// Core function to check if a number is registered on WhatsApp
async function checkWhatsAppContact(phoneNumber, countryCode = config.defaultCountryCode) {
  try {
    const formattedNumber = formatPhoneForWhatsApp(phoneNumber, countryCode);
    const id = `${formattedNumber}@c.us`;

    // Get contact info - this returns null for non-existent contacts
    const contact = await client.getContactById(id);

    // Check if the number exists on WhatsApp
    const isRegistered = await client.isRegisteredUser(id);

    return {
      inputPhoneNumber: phoneNumber,
      formattedPhoneNumber: formattedNumber,
      whatsappId: id,
      exists: isRegistered,
      contact: contact ? {
        name: contact.name || contact.pushname || null,
        shortName: contact.shortName || null,
      } : null,
    };
  } catch (error) {
    throw new Error(`Failed to check WhatsApp contact: ${error.message}`);
  }
}

// Middleware to ensure the client is ready before processing API requests
function ensureClientReady(req, res, next) {
  if (!client || !client.info) {
    return res.status(503).json({
      success: false,
      error: "WhatsApp client not ready yet. Please try again later.",
      status: "initializing",
    });
  }
  next();
}

// ========================= WHATSAPP API ROUTES =========================

// WhatsApp API router
const whatsappRouter = express.Router();

// Check a single phone number
whatsappRouter.post("/check", ensureClientReady, async (req, res) => {
  try {
    const { phoneNumber, countryCode } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required",
      });
    }

    const result = await checkWhatsAppContact(
      phoneNumber,
      countryCode || config.defaultCountryCode
    );

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Error checking phone number:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Check multiple phone numbers in batch
whatsappRouter.post("/check-batch", ensureClientReady, async (req, res) => {
  try {
    const { phoneNumbers, countryCode } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
      return res.status(400).json({
        success: false,
        error: "phoneNumbers array is required",
      });
    }

    if (phoneNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: "phoneNumbers array cannot be empty",
      });
    }

    if (phoneNumbers.length > config.maxBatchSize) {
      return res.status(400).json({
        success: false,
        error: `Batch size exceeds maximum limit of ${config.maxBatchSize}`,
      });
    }

    const results = [];
    let errors = 0;

    // Process each phone number
    for (const phone of phoneNumbers) {
      try {
        const result = await checkWhatsAppContact(
          phone,
          countryCode || config.defaultCountryCode
        );
        results.push(result);
      } catch (error) {
        console.error(`Error checking phone ${phone}:`, error);
        errors++;
        results.push({
          inputPhoneNumber: phone,
          error: error.message,
          exists: false,
        });
      }
    }

    res.json({
      success: true,
      total: phoneNumbers.length,
      processed: results.length,
      errors,
      results,
    });
  } catch (error) {
    console.error("Error in batch check:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Check server and client status
whatsappRouter.get("/status", async (req, res) => {
  try {
    const state = client.getState();
    const info = client.info || {};

    res.json({
      success: true,
      status: {
        client: state || "INITIALIZING",
        ready: !!client.info,
      },
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

// ========================= CEP CHECKER ROUTES =========================

// CEP Checker router
const cepRouter = express.Router();

/**
 * Validates a Brazilian CEP (ZIP code) by calling the ViaCEP API
 * @param {string} cep - The CEP to validate (numbers only)
 * @returns {Promise} - Promise that resolves with the validation result
 */
function validateCEP(cep) {
  return new Promise((resolve, reject) => {
    // Basic format validation
    const cleanCep = cep.replace(/[^0-9]/g, '');

    if (cleanCep.length !== 8) {
      return resolve({
        isValid: false,
        message: 'CEP must have 8 digits',
        cep: cleanCep
      });
    }

    // Call the ViaCEP API
    const url = `https://viacep.com.br/ws/${cleanCep}/json/`;

    https
      .get(url, (response) => {
        let data = '';

        // A chunk of data has been received
        response.on('data', (chunk) => {
          data += chunk;
        });

        // The whole response has been received
        response.on('end', () => {
          try {
            const result = JSON.parse(data);

            if (result.erro) {
              resolve({
                isValid: false,
                message: 'Invalid CEP',
                cep: cleanCep
              });
            } else {
              resolve({
                isValid: true,
                message: 'Valid CEP',
                cep: cleanCep,
                data: result
              });
            }
          } catch (error) {
            reject({
              isValid: false,
              message: 'Error processing response',
              error: error.message
            });
          }
        });
      })
      .on('error', (error) => {
        reject({
          isValid: false,
          message: 'Error calling ViaCEP API',
          error: error.message
        });
      });
  });
}

// Health check endpoint
cepRouter.get('/', (req, res) => {
  res.json({ message: 'CEP Validator API is running' });
});

// CEP validation endpoint - GET method
cepRouter.get('/validate-cep/:cep', async (req, res) => {
  try {
    const cepValue = req.params.cep;
    const result = await validateCEP(cepValue);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      isValid: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// CEP validation endpoint - POST method
cepRouter.post('/validate-cep', async (req, res) => {
  try {
    const { cep } = req.body;

    if (!cep) {
      return res.status(400).json({
        isValid: false,
        message: 'CEP is required in the request body'
      });
    }

    const result = await validateCEP(cep);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      isValid: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ========================= REGISTER ROUTERS =========================

// Register the routers with their respective base paths
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/cep', cepRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Basic documentation endpoint
app.get("/", (req, res) => {
  const clientReady = client && client.info;

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Unified API Service</title>
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
        <h1>Unified API Service</h1>
        <p>This service provides both WhatsApp number validation and Brazilian CEP validation APIs.</p>

        <div class="${clientReady ? "status ready" : "status not-ready"}">
          <strong>WhatsApp Status:</strong> ${clientReady ? "Ready - WhatsApp Web client connected" : "Waiting for QR Code scan..."}
        </div>

        <h2>API Endpoints:</h2>
        <table>
          <tr>
            <th>Service</th>
            <th>Endpoint</th>
            <th>Method</th>
            <th>Description</th>
          </tr>
          <tr>
            <td rowspan="3">WhatsApp</td>
            <td><code>/api/whatsapp/check</code></td>
            <td>POST</td>
            <td>Check a single phone number</td>
          </tr>
          <tr>
            <td><code>/api/whatsapp/check-batch</code></td>
            <td>POST</td>
            <td>Check multiple phone numbers (up to ${config.maxBatchSize})</td>
          </tr>
          <tr>
            <td><code>/api/whatsapp/status</code></td>
            <td>GET</td>
            <td>Check WhatsApp API health and connection status</td>
          </tr>
          <tr>
            <td rowspan="3">CEP</td>
            <td><code>/api/cep</code></td>
            <td>GET</td>
            <td>Check if CEP validator is running</td>
          </tr>
          <tr>
            <td><code>/api/cep/validate-cep/:cep</code></td>
            <td>GET</td>
            <td>Validate a CEP (GET method)</td>
          </tr>
          <tr>
            <td><code>/api/cep/validate-cep</code></td>
            <td>POST</td>
            <td>Validate a CEP (POST method)</td>
          </tr>
          <tr>
            <td>General</td>
            <td><code>/health</code></td>
            <td>GET</td>
            <td>Basic server health check</td>
          </tr>
        </table>

        <h2>Example Usage:</h2>
        <h3>WhatsApp API:</h3>
        <pre>
// Single phone check
POST /api/whatsapp/check
{
  "phoneNumber": "11987654321",
  "countryCode": "55"  // Optional
}

// Multiple phone check
POST /api/whatsapp/check-batch
{
  "phoneNumbers": ["11987654321", "1187654321", "(11) 98765-4321"],
  "countryCode": "55"  // Optional
}
        </pre>

        <h3>CEP API:</h3>
        <pre>
// GET method
GET /api/cep/validate-cep/01001000

// POST method
POST /api/cep/validate-cep
{
  "cep": "01001000"
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

        <h2>WhatsApp Setup Instructions:</h2>
        <ol>
          <li>Start the server</li>
          <li>Scan the QR code that appears in the terminal with WhatsApp on your phone</li>
          <li>Once connected, you can use the WhatsApp API endpoints</li>
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
  console.log(`Unified server is running on port ${config.port}`);
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
        "You can try restarting the application or accessing /api/whatsapp/status to check server health.",
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
