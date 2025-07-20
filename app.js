// Production-ready WhatsApp API server
const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

// Global client variable
let client = null;

// Initialize WhatsApp Client function
function initializeWhatsAppClient() {
  const whatsappClient = new Client({
    authStrategy: new LocalAuth({
      clientId: "wap-is-whats-number",
      dataPath: path.join(__dirname, "./sessions"),
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
      ],
    },
  });

  // Handle QR code generation
  whatsappClient.on("qr", (qr) => {
    console.log("QR RECEIVED. Scan this with your WhatsApp app:");
    qrcode.generate(qr, { small: true });

    // Optional: Save QR code to file for remote access
    const qrcode_img = require("qrcode");
    qrcode_img.toFile("./qr-code.png", qr, (err) => {
      if (err) console.error("Error saving QR code:", err);
      else console.log("QR code saved to qr-code.png");
    });
  });

  // Handle client ready event
  whatsappClient.on("ready", () => {
    console.log("WhatsApp client is ready!");
  });

  // Handle authentication
  whatsappClient.on("authenticated", () => {
    console.log("WhatsApp client authenticated");
  });

  // Handle authentication failures
  whatsappClient.on("auth_failure", (msg) => {
    console.error("WhatsApp authentication failed:", msg);
  });

  // Handle disconnection
  whatsappClient.on("disconnected", (reason) => {
    console.log("Client was logged out", reason);
    // Auto-reconnect after 10 seconds
    setTimeout(() => {
      console.log("Attempting to reconnect...");
      initializeWhatsAppClient();
    }, 10000);
  });

  // Initialize the client
  whatsappClient.initialize();

  return whatsappClient;
}

// Initialize Express app
const app = express();

// Trust proxy (important for production behind reverse proxy)
app.set("trust proxy", true);

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Enhanced CORS for production
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["*"];

  const origin = req.headers.origin;

  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }
  next();
});

// Security headers
app.use((req, res, next) => {
  res.header("X-Frame-Options", "DENY");
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-XSS-Protection", "1; mode=block");
  next();
});

// Rate limiting (simple implementation)
const rateLimitMap = new Map();
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimitMap.has(clientIP)) {
      rateLimitMap.set(clientIP, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const clientData = rateLimitMap.get(clientIP);

    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + windowMs;
      return next();
    }

    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: "Too many requests, please try again later.",
      });
    }

    clientData.count++;
    next();
  };
};

// Apply rate limiting to API routes
app.use("/api/", rateLimit(100, 15 * 60 * 1000)); // 100 requests per 15 minutes

// Configuration with environment variables
const config = {
  port: process.env.PORT || 3003,
  host: process.env.HOST || "0.0.0.0", // Listen on all interfaces
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || "55",
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || "20", 10),
  enableCEP: process.env.ENABLE_CEP !== "false",
  apiKey: process.env.API_KEY, // Optional API key for authentication
};

// API Key middleware (optional)
function requireApiKey(req, res, next) {
  if (!config.apiKey) {
    return next(); // No API key required
  }

  const providedKey = req.headers["x-api-key"] || req.query.apiKey;

  if (!providedKey || providedKey !== config.apiKey) {
    return res.status(401).json({
      success: false,
      error: "Invalid or missing API key",
    });
  }

  next();
}

// Utility function to format phone numbers
function formatPhoneNumber(
  phoneNumber,
  countryCode = config.defaultCountryCode,
) {
  let cleaned = phoneNumber.replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  if (phoneNumber.startsWith("+")) {
    return cleaned;
  }

  if (cleaned.startsWith(countryCode)) {
    return cleaned;
  }

  return countryCode + cleaned;
}

// Function to check if a number is registered on WhatsApp
async function checkWhatsAppNumber(
  phoneNumber,
  countryCode = config.defaultCountryCode,
) {
  try {
    const formattedNumber = formatPhoneNumber(phoneNumber, countryCode);
    const id = `${formattedNumber}@c.us`;

    const isRegistered = await client.isRegisteredUser(id);

    return {
      inputPhoneNumber: phoneNumber,
      formattedPhoneNumber: formattedNumber,
      exists: isRegistered,
    };
  } catch (error) {
    console.error(`Error checking number ${phoneNumber}:`, error);
    throw new Error(`Failed to check WhatsApp number: ${error.message}`);
  }
}

// Middleware to ensure client is ready
function ensureClientReady(req, res, next) {
  if (!client || !client.info) {
    return res.status(503).json({
      success: false,
      error: "WhatsApp client not ready yet. Please try again later.",
    });
  }
  next();
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Serve QR code image for remote setup
app.get("/qr", (req, res) => {
  const qrPath = path.join(__dirname, "qr-code.png");
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.status(404).json({ error: "QR code not available" });
  }
});

// Check a single phone number
app.post("/api/check", requireApiKey, ensureClientReady, async (req, res) => {
  try {
    const { phoneNumber, countryCode } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required",
      });
    }

    const result = await checkWhatsAppNumber(phoneNumber, countryCode);

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

// Check multiple phone numbers
app.post(
  "/api/check-batch",
  requireApiKey,
  ensureClientReady,
  async (req, res) => {
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

      for (const phone of phoneNumbers) {
        try {
          const result = await checkWhatsAppNumber(phone, countryCode);
          results.push(result);
        } catch (error) {
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
  },
);

// Get WhatsApp client status
app.get("/api/status", async (req, res) => {
  try {
    res.json({
      success: true,
      status: {
        client: client
          ? client.getState() || "INITIALIZING"
          : "NOT_INITIALIZED",
        ready: !!(client && client.info),
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Enhanced home page with production info
app.get("/", (req, res) => {
  const clientReady = client && client.info;

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>WhatsApp Number Checker API</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
          .ready { background: #d4edda; color: #155724; }
          .not-ready { background: #f8d7da; color: #721c24; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
          .info { background: #d1ecf1; color: #0c5460; padding: 10px; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1>WhatsApp Number Checker API</h1>

        <div class="${clientReady ? "status ready" : "status not-ready"}">
          <strong>Status:</strong> ${clientReady ? "Ready - WhatsApp Web client connected" : "Waiting for QR Code scan..."}
        </div>

        ${
          !clientReady
            ? `
        <div class="info">
          <strong>Setup Required:</strong> Visit <a href="/qr">/qr</a> to get the QR code for WhatsApp setup.
        </div>
        `
            : ""
        }

        <div class="info">
          <strong>Server:</strong> Running on port ${config.port}<br>
          <strong>API Key Required:</strong> ${config.apiKey ? "Yes" : "No"}<br>
          <strong>Max Batch Size:</strong> ${config.maxBatchSize}<br>
          <strong>CEP Validation:</strong> ${config.enableCEP ? "Enabled" : "Disabled"}
        </div>

        <h2>API Endpoints:</h2>
        <ul>
          <li><strong>POST /api/check</strong> - Check a single phone number</li>
          <li><strong>POST /api/check-batch</strong> - Check multiple phone numbers</li>
          <li><strong>GET /api/status</strong> - Check API status</li>
          <li><strong>GET /health</strong> - Health check</li>
          <li><strong>GET /qr</strong> - Get QR code for setup</li>
          ${
            config.enableCEP
              ? `
          <li><strong>GET /api/cep/validate-cep/:cep</strong> - Validate a CEP</li>
          <li><strong>POST /api/cep/validate-cep</strong> - Validate a CEP</li>
          `
              : ""
          }
        </ul>

        <h2>Example Usage:</h2>
        <pre>
// Headers${
    config.apiKey
      ? `
X-API-Key: your-api-key-here`
      : ""
  }
Content-Type: application/json

// Single phone check
POST /api/check
{
  "phoneNumber": "11987654321",
  "countryCode": "55"
}

// Multiple phone check
POST /api/check-batch
{
  "phoneNumbers": ["11987654321", "1187654321"],
  "countryCode": "55"
}
        </pre>
      </body>
    </html>
  `);
});

// CEP validation functions (keeping original implementation)
function validateCEP(cep) {
  return new Promise((resolve, reject) => {
    const cleanCep = cep.replace(/[^0-9]/g, "");

    if (cleanCep.length !== 8) {
      return resolve({
        isValid: false,
        message: "CEP must have 8 digits",
        cep: cleanCep,
      });
    }

    const url = `https://viacep.com.br/ws/${cleanCep}/json/`;

    https
      .get(url, (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          try {
            const result = JSON.parse(data);

            if (result.erro) {
              resolve({
                isValid: false,
                message: "Invalid CEP",
                cep: cleanCep,
              });
            } else {
              resolve({
                isValid: true,
                message: "Valid CEP",
                cep: cleanCep,
                data: result,
              });
            }
          } catch (error) {
            reject({
              isValid: false,
              message: "Error processing response",
              error: error.message,
            });
          }
        });
      })
      .on("error", (error) => {
        reject({
          isValid: false,
          message: "Error calling ViaCEP API",
          error: error.message,
        });
      });
  });
}

// CEP API Routes
if (config.enableCEP) {
  console.log("CEP validation enabled");

  app.get("/api/cep", (req, res) => {
    res.json({ message: "CEP Validator API is running" });
  });

  app.get("/api/cep/validate-cep/:cep", requireApiKey, async (req, res) => {
    try {
      const cepValue = req.params.cep;
      const result = await validateCEP(cepValue);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        isValid: false,
        message: "Server error",
        error: error.message,
      });
    }
  });

  app.post("/api/cep/validate-cep", requireApiKey, async (req, res) => {
    try {
      const { cep } = req.body;

      if (!cep) {
        return res.status(400).json({
          isValid: false,
          message: "CEP is required in the request body",
        });
      }

      const result = await validateCEP(cep);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        isValid: false,
        message: "Server error",
        error: error.message,
      });
    }
  });
}

// Start the application
function startApplication() {
  console.log("Initializing WhatsApp client...");

  client = initializeWhatsAppClient();
  console.log("WhatsApp client initialized");

  const server = http.createServer(app);

  server.listen(config.port, config.host, () => {
    console.log(`Server running on ${config.host}:${config.port}`);
    console.log(`External access: http://YOUR_SERVER_IP:${config.port}/`);
    console.log(`WhatsApp validation: Enabled`);
    console.log(`CEP validation: ${config.enableCEP ? "Enabled" : "Disabled"}`);
    console.log(
      `API Key protection: ${config.apiKey ? "Enabled" : "Disabled"}`,
    );
  });

  // Graceful shutdown
  const gracefulShutdown = () => {
    console.log("\nShutdown signal received. Shutting down gracefully...");
    try {
      if (client) {
        console.log("Closing WhatsApp client...");
        client.destroy();
      }
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
}

// Start the application
startApplication();

// Error handling
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  if (client) {
    try {
      client.destroy();
    } catch (destroyError) {
      console.error("Error destroying client:", destroyError);
    }
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  if (client) {
    try {
      client.destroy();
    } catch (destroyError) {
      console.error("Error destroying client:", destroyError);
    }
  }
  process.exit(1);
});
