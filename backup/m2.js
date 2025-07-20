// m2 última solução com base nas pesquisas...
// como debugar => eu estava fazendo o que sempre fiz sem pensar
// que o método do whatsapp poderia ter sido alterado ?
const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

// Global client variable
let client = null;

// Initialize WhatsApp Client function (merged from client.js)
function initializeWhatsAppClient() {
  return new Promise((resolve, reject) => {
    // Ensure sessions directory exists with proper permissions
    const sessionsPath = path.join(__dirname, "./sessions");
    if (!fs.existsSync(sessionsPath)) {
      fs.mkdirSync(sessionsPath, { recursive: true });
      console.log("Created sessions directory:", sessionsPath);

      // Set proper permissions on Linux/Unix systems
      try {
        fs.chmodSync(sessionsPath, 0o755);
        console.log("Set directory permissions to 755");
      } catch (error) {
        console.log(
          "Could not set directory permissions (this might be normal on Windows)",
        );
      }
    }

    const whatsappClient = new Client({
      authStrategy: new LocalAuth({
        clientId: "wap-is-whats-number", // Unique identifier for this client
        dataPath: sessionsPath, // Use absolute path to ensure correct location
      }),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-extensions",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
        ],
      },
    });

    let qrReceived = false;
    let authenticated = false;
    let isReady = false;
    let sessionSaveStartTime = null;

    // Handle QR code generation
    whatsappClient.on("qr", (qr) => {
      qrReceived = true;
      console.log("QR RECEIVED. Scan this with your WhatsApp app:");
      qrcode.generate(qr, { small: true });
      console.log("Waiting for QR code scan...");
      console.log(
        "IMPORTANT: After scanning, please wait at least 2-3 minutes before stopping the server",
      );
      console.log(
        "This allows the session to be properly saved for future use.",
      );
    });

    // Handle client ready event
    whatsappClient.on("ready", async () => {
      console.log("WhatsApp client is ready!");
      console.log(
        `Connected as: ${whatsappClient.info.pushname} (${whatsappClient.info.wid.user})`,
      );

      if (qrReceived) {
        // If this was a new authentication (QR code was shown), wait longer for session to save
        console.log(
          "New authentication detected. Waiting extended time for session to save properly...",
        );
        sessionSaveStartTime = Date.now();

        setTimeout(() => {
          isReady = true;
          const waitTime = Math.round(
            (Date.now() - sessionSaveStartTime) / 1000,
          );
          console.log(
            `Session should now be saved after ${waitTime} seconds. Client is fully ready!`,
          );
          resolve(whatsappClient);
        }, 15000); // Wait 15 seconds for new authentication
      } else {
        // If using existing session, shorter wait
        console.log("Using existing session. Shorter wait time...");
        setTimeout(() => {
          isReady = true;
          console.log("Client is now fully ready!");
          resolve(whatsappClient);
        }, 3000); // Wait 3 seconds for existing session
      }
    });

    // Handle authentication
    whatsappClient.on("authenticated", (session) => {
      authenticated = true;
      console.log("WhatsApp client authenticated successfully");
      if (!qrReceived) {
        console.log("Used existing session - no QR code required");
      } else {
        console.log("New authentication completed - session is being saved...");
        sessionSaveStartTime = Date.now();
      }
    });

    // Handle authentication failures
    whatsappClient.on("auth_failure", (msg) => {
      console.error("WhatsApp authentication failed:", msg);
      console.log(
        "This might be due to an expired or corrupted session. Cleaning up...",
      );

      // Delete the session directory and retry
      const sessionPath = path.join(
        sessionsPath,
        "session-wap-is-whats-number",
      );
      if (fs.existsSync(sessionPath)) {
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          console.log("Deleted corrupted session");
        } catch (error) {
          console.error("Error deleting session:", error);
        }
      }

      reject(new Error(`Authentication failed: ${msg}`));
    });

    // Handle initialization errors
    whatsappClient.on("disconnected", (reason) => {
      console.log("WhatsApp client disconnected:", reason);

      // If disconnected due to session issues, clean up
      if (reason === "UNPAIRED" || reason === "UNPAIRED_DEVICE") {
        console.log("Device was unpaired. Cleaning up session...");
        const sessionPath = path.join(
          sessionsPath,
          "session-wap-is-whats-number",
        );
        if (fs.existsSync(sessionPath)) {
          try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log("Cleaned up unpaired session");
          } catch (error) {
            console.error("Error cleaning up session:", error);
          }
        }
      }
    });

    // Handle loading screen
    whatsappClient.on("loading_screen", (percent, message) => {
      console.log("Loading screen:", percent, message);
    });

    // Check if session exists
    const sessionPath = path.join(sessionsPath, "session-wap-is-whats-number");
    const sessionExists = fs.existsSync(sessionPath);
    console.log("Session exists:", sessionExists);
    console.log("Session path:", sessionPath);

    if (sessionExists) {
      // Check if session directory has files and proper permissions
      try {
        const sessionFiles = fs.readdirSync(sessionPath);
        console.log("Session directory contents:", sessionFiles);

        if (sessionFiles.length === 0) {
          console.log("Session directory is empty, removing it...");
          fs.rmSync(sessionPath, { recursive: true, force: true });
        } else {
          console.log(
            "Valid session found, should authenticate without QR code",
          );

          // Check if we can write to the session directory
          try {
            const testFile = path.join(sessionPath, "test-write.tmp");
            fs.writeFileSync(testFile, "test");
            fs.unlinkSync(testFile);
            console.log("Session directory is writable");
          } catch (error) {
            console.log(
              "Warning: Session directory might not be writable:",
              error.message,
            );
          }
        }
      } catch (error) {
        console.error("Error reading session directory:", error);
        console.log("Removing potentially corrupted session directory...");
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        } catch (removeError) {
          console.error("Error removing corrupted session:", removeError);
        }
      }
    }

    // Initialize the client
    console.log("Starting WhatsApp client initialization...");
    whatsappClient.initialize().catch((error) => {
      console.error("Failed to initialize WhatsApp client:", error);
      reject(error);
    });

    // Set a timeout to prevent hanging
    const initTimeout = setTimeout(() => {
      if (!isReady) {
        reject(new Error("WhatsApp client initialization timeout"));
      }
    }, 300000); // 5 minutes timeout

    // Clear timeout when ready
    whatsappClient.on("ready", () => {
      clearTimeout(initTimeout);
    });

    // If no QR code and no authentication after 60 seconds with existing session, check for issues
    setTimeout(() => {
      if (!qrReceived && !authenticated && sessionExists) {
        console.log(
          "No QR code or authentication after 60 seconds with existing session.",
        );
        console.log(
          "This might indicate a corrupted session. The session will be automatically cleaned up.",
        );

        // Auto-cleanup corrupted session
        const sessionPath = path.join(
          sessionsPath,
          "session-wap-is-whats-number",
        );
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          console.log(
            "Corrupted session removed. Please restart the application.",
          );
        } catch (error) {
          console.error("Error removing corrupted session:", error);
        }

        reject(
          new Error(
            "Session appears to be corrupted. Please restart the application.",
          ),
        );
      }
    }, 60000); // 1 minute
  });
}

// Initialize Express app
const app = express();
app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept",
  );
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "GET, POST");
    return res.status(200).json({});
  }
  next();
});

// Simple configuration
const config = {
  port: process.env.PORT || 3003,
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || "55",
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || "20", 10),
  enableCEP: process.env.ENABLE_CEP !== "false",
};

// Function to wait for client to be ready (synchronous approach)
function waitForClientReady(whatsappClient) {
  return new Promise((resolve) => {
    if (whatsappClient.info) {
      // Client is already ready
      console.log("WhatsApp client is already ready!");
      resolve();
    } else {
      // Wait for ready event
      whatsappClient.once("ready", () => {
        console.log("WhatsApp client is now ready!");
        resolve();
      });
    }
  });
}

// Utility function to format phone numbers
function formatPhoneNumber(
  phoneNumber,
  countryCode = config.defaultCountryCode,
) {
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

// Function to check if a number is registered on WhatsApp
async function checkWhatsAppNumber(
  phoneNumber,
  countryCode = config.defaultCountryCode,
) {
  try {
    const formattedNumber = formatPhoneNumber(phoneNumber, countryCode);
    const id = `${formattedNumber}@c.us`;

    // Check if the number exists on WhatsApp
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

// API Routes
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Check a single phone number
app.post("/api/check", ensureClientReady, async (req, res) => {
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
app.post("/api/check-batch", ensureClientReady, async (req, res) => {
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
});

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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Home page with basic documentation
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
        </style>
      </head>
      <body>
        <h1>WhatsApp Number Checker API</h1>

        <div class="${clientReady ? "status ready" : "status not-ready"}">
          <strong>Status:</strong> ${clientReady ? "Ready - WhatsApp Web client connected" : "Waiting for QR Code scan..."}
        </div>

        <h2>API Endpoints:</h2>
        <ul>
          <li><strong>POST /api/check</strong> - Check a single phone number</li>
          <li><strong>POST /api/check-batch</strong> - Check multiple phone numbers (up to ${config.maxBatchSize})</li>
          <li><strong>GET /api/status</strong> - Check API status</li>
          <li><strong>GET /health</strong> - Health check</li>
          ${
            config.enableCEP
              ? `
          <li><strong>GET /api/cep/validate-cep/:cep</strong> - Validate a CEP (GET method)</li>
          <li><strong>POST /api/cep/validate-cep</strong> - Validate a CEP (POST method)</li>
          `
              : ""
          }
        </ul>

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
  "phoneNumbers": ["11987654321", "1187654321"],
  "countryCode": "55"  // Optional
}
${
  config.enableCEP
    ? `
// CEP validation (GET)
GET /api/cep/validate-cep/01001000

// CEP validation (POST)
POST /api/cep/validate-cep
{
  "cep": "01001000"
}`
    : ""
}
        </pre>
      </body>
    </html>
  `);
});

// ===== CEP Validation Functions =====

/**
 * Validates a Brazilian CEP (ZIP code) by calling the ViaCEP API
 * @param {string} cep - The CEP to validate (numbers only)
 * @returns {Promise} - Promise that resolves with the validation result
 */
function validateCEP(cep) {
  return new Promise((resolve, reject) => {
    // Basic format validation
    const cleanCep = cep.replace(/[^0-9]/g, "");

    if (cleanCep.length !== 8) {
      return resolve({
        isValid: false,
        message: "CEP must have 8 digits",
        cep: cleanCep,
      });
    }

    // Call the ViaCEP API
    const url = `https://viacep.com.br/ws/${cleanCep}/json/`;

    https
      .get(url, (response) => {
        let data = "";

        // A chunk of data has been received
        response.on("data", (chunk) => {
          data += chunk;
        });

        // The whole response has been received
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

  // CEP health check
  app.get("/api/cep", (req, res) => {
    res.json({ message: "CEP Validator API is running" });
  });

  // CEP validation - GET method
  app.get("/api/cep/validate-cep/:cep", async (req, res) => {
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

  // CEP validation - POST method
  app.post("/api/cep/validate-cep", async (req, res) => {
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

// Start the application (FIXED - single function with proper synchronous flow)
async function startApplication() {
  try {
    // Check existing sessions first
    const sessionsPath = path.join(__dirname, "./sessions");
    console.log("Checking for existing sessions in:", sessionsPath);

    if (fs.existsSync(sessionsPath)) {
      const sessionFiles = fs.readdirSync(sessionsPath);
      console.log("Existing session files:", sessionFiles);

      if (sessionFiles.length > 0) {
        console.log(
          "Found existing session files - should not require QR code",
        );
      } else {
        console.log("No session files found - will require QR code scan");
      }
    } else {
      console.log("Sessions directory does not exist - will be created");
    }

    console.log("Initializing WhatsApp client...");

    // Initialize the client and wait for it to be ready in one step
    client = await initializeWhatsAppClient();
    console.log("WhatsApp client initialization complete!");

    // Create and start the server only after client is ready
    const server = http.createServer(app);

    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Visit http://localhost:${config.port}/ for documentation`);
      console.log(`WhatsApp validation: Enabled`);
      console.log(
        `CEP validation: ${config.enableCEP ? "Enabled" : "Disabled"}`,
      );
      console.log("WhatsApp client info:", {
        number: client.info?.wid?.user,
        name: client.info?.pushname,
        connected: client.info?.connected,
      });
    });

    // Handle graceful shutdown
    const gracefulShutdown = async () => {
      console.log("\nShutdown signal received. Shutting down gracefully...");
      try {
        if (client) {
          console.log("Closing WhatsApp client...");
          await client.destroy();
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

    // Handle SIGINT (Ctrl+C)
    process.on("SIGINT", gracefulShutdown);

    // Handle SIGTERM
    process.on("SIGTERM", gracefulShutdown);
  } catch (error) {
    console.error("Failed to start application:", error);
    if (client) {
      try {
        await client.destroy();
      } catch (destroyError) {
        console.error("Error destroying client:", destroyError);
      }
    }
    process.exit(1);
  }
}

// Start the application
startApplication();

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
  console.error("Uncaught Exception:", error);
  if (client) {
    try {
      await client.destroy();
    } catch (destroyError) {
      console.error("Error destroying client:", destroyError);
    }
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  if (client) {
    try {
      await client.destroy();
    } catch (destroyError) {
      console.error("Error destroying client:", destroyError);
    }
  }
  process.exit(1);
});
