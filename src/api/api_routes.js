// API Routes
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Check a single phone number
app.post("/api/wap/is_wap_number", ensureClientReady, async (req, res) => {
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
  "/api/wap/is_wap_number/batch",
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
  },
);

// Get WhatsApp client status
app.get("/api/wap/status", async (req, res) => {
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

// Routes
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
