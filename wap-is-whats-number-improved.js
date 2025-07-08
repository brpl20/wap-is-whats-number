const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const rateLimit = require("express-rate-limit");

// Initialize Express app
const app = express();
app.use(express.json());

// Configure rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: "Too many requests, please try again later." }
});

// Apply rate limiting to all endpoints
app.use(apiLimiter);

// Request logging middleware
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

// Initialize the WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

// Set up client event handlers
client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("error", (error) => {
  console.error("An error occurred:", error);
});

client.on("disconnected", (reason) => {
  console.log("Client disconnected:", reason);
  // Attempt to reconnect after delay
  setTimeout(() => {
    console.log("Attempting to reconnect...");
    client.initialize().catch(err =>
      console.error("Failed to reinitialize client:", err)
    );
  }, 5000);
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("QR Code generated. Please scan with your WhatsApp app.");
});

client.initialize().catch(err => {
  console.error("Failed to initialize WhatsApp client:", err);
  process.exit(1);
});

/**
 * Formats a phone number for WhatsApp API
 *
 * @param {string} phone - The phone number to format
 * @param {string} countryCode - The default country code to use (default: "55" for Brazil)
 * @returns {string} Formatted phone number or "N/A" if invalid
 */
function formatPhoneForWhatsApp(phone, countryCode = "55") {
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
      setTimeout(() => reject(new Error("Operation timed out")), 10000);
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
      error: "WhatsApp client not ready yet. Please try again later."
    });
  }
  next();
}

// Apply client ready middleware to relevant endpoints
app.use(["/checkSingleWhatsApp", "/checkWhatsApp"], ensureClientReady);

// Endpoint to check if a single phone number is registered on WhatsApp
app.post("/checkSingleWhatsApp", async (req, res) => {
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
        isValidWhatsApp: false
      });
    }

    const isValidWhatsApp = await checkWhatsAppContact(whatsappId);

    res.json({
      phoneNumber,
      formattedNumber: whatsappId,
      isValidWhatsApp
    });
  } catch (error) {
    console.error("Error in /checkSingleWhatsApp:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Endpoint to check if multiple phone numbers are registered on WhatsApp
app.post("/checkWhatsApp", async (req, res) => {
  const { phoneNumbers, countryCode } = req.body;

  if (!Array.isArray(phoneNumbers)) {
    return res
      .status(400)
      .json({ error: "Invalid input, expected an array of phone numbers." });
  }

  try {
    // Process in batches to avoid overwhelming the WhatsApp API
    const BATCH_SIZE = 20;
    let results = [];

    for (let i = 0; i < phoneNumbers.length; i += BATCH_SIZE) {
      const batch = phoneNumbers.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (phone) => {
          const whatsappId = formatPhoneForWhatsApp(phone, countryCode);

          if (whatsappId === "N/A") {
            return {
              phone,
              formattedNumber: whatsappId,
              isValidWhatsApp: false
            };
          }

          const isValidWhatsApp = await checkWhatsAppContact(whatsappId);

          return {
            phone,
            formattedNumber: whatsappId,
            isValidWhatsApp
          };
        }),
      );

      results = [...results, ...batchResults];
    }

    res.json(results);
  } catch (error) {
    console.error("Error in /checkWhatsApp:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Endpoint to check the API status and health
app.get("/getStatus", async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({
        success: false,
        status: "Client not initialized"
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
        connected: !!state
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Basic documentation endpoint
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>WhatsApp Number Validation API</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #075e54; }
          h2 { color: #128c7e; }
          code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>WhatsApp Number Validation API</h1>
        <p>This API checks if phone numbers are registered on WhatsApp.</p>

        <h2>Endpoints:</h2>
        <ul>
          <li><code>GET /getStatus</code> - Check API health</li>
          <li><code>POST /checkSingleWhatsApp</code> - Check a single phone number</li>
          <li><code>POST /checkWhatsApp</code> - Check multiple phone numbers</li>
        </ul>

        <h2>Example Usage:</h2>
        <pre>
// Single phone check
POST /checkSingleWhatsApp
{
  "phoneNumber": "11987654321",
  "countryCode": "55"  // Optional
}

// Multiple phone check
POST /checkWhatsApp
{
  "phoneNumbers": ["11987654321", "1187654321"],
  "countryCode": "55"  // Optional
}
        </pre>
      </body>
    </html>
  `);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message
  });
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API documentation available at http://localhost:${PORT}/`);
});

// Handle graceful shutdown
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function shutdown() {
  console.log("Gracefully shutting down...");
  try {
    if (client) {
      console.log("Closing WhatsApp client connection...");
      await client.destroy();
    }
    console.log("Shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}
