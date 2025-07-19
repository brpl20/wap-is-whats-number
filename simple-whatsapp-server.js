const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { initializeWhatsAppClient } = require("./client");

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

// Initialize WhatsApp client - will be set later
let client = null;

// Function to wait for client to be ready
async function waitForClientReady(whatsappClient) {
  return new Promise((resolve) => {
    if (whatsappClient.info) {
      // Client is already ready
      console.log("WhatsApp client already authenticated and ready");
      resolve();
    } else {
      // Wait for ready event
      whatsappClient.on("ready", () => {
        console.log("WhatsApp client authenticated");
        console.log("WhatsApp client is ready!");
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
        client: client.getState() || "INITIALIZING",
        ready: !!client.info,
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

// Start the application
async function startApplication() {
  try {
    console.log("Initializing WhatsApp client...");
    client = await initializeWhatsAppClient();
    console.log("WhatsApp client initialized");

    // Wait for client to be ready before starting server
    await waitForClientReady(client);

    // Create and start the server
    const server = http.createServer(app);

    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Visit http://localhost:${config.port}/ for documentation`);
      console.log(`WhatsApp validation: Enabled`);
      console.log(
        `CEP validation: ${config.enableCEP ? "Enabled" : "Disabled"}`,
      );
    });

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\nSIGINT received. Shutting down gracefully...");
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
    });

    // Handle SIGTERM
    process.on("SIGTERM", async () => {
      console.log("\nSIGTERM received. Shutting down gracefully...");
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
    });
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

// Start the application
startApplication();

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  if (client) {
    client.destroy().catch(console.error);
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  if (client) {
    client.destroy().catch(console.error);
  }
  process.exit(1);
});
