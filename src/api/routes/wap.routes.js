const express = require('express');
const router = express.Router();
const wapFacade = require('../../wap/wap');
const config = require('../config');

// Initialize WhatsApp client when module loads
let clientInitialized = false;

function initializeClient() {
  if (!clientInitialized) {
    console.log('Initializing WhatsApp client from API...');
    wapFacade.initializeClient();
    clientInitialized = true;
  }
}

// Initialize on module load
initializeClient();

// Middleware to ensure client is ready
const ensureClientReady = wapFacade.ensureClientReady();

// Get WhatsApp client status
router.get('/status', async (req, res) => {
  try {
    const client = wapFacade.getClient();
    res.json({
      success: true,
      status: {
        initialized: clientInitialized,
        ready: wapFacade.isClientReady(),
        state: client ? (await client.getState()) || 'INITIALIZING' : 'NOT_INITIALIZED'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check a single phone number
router.post('/check', ensureClientReady, async (req, res) => {
  try {
    const { phoneNumber, countryCode } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    const result = await wapFacade.checkWhatsAppNumber(phoneNumber, countryCode);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error checking phone number:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check multiple phone numbers
router.post('/check/batch', ensureClientReady, async (req, res) => {
  try {
    const { phoneNumbers, countryCode } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumbers array is required'
      });
    }

    if (phoneNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumbers array cannot be empty'
      });
    }

    if (phoneNumbers.length > config.maxBatchSize) {
      return res.status(400).json({
        success: false,
        error: `Batch size exceeds maximum limit of ${config.maxBatchSize}`
      });
    }

    const results = [];
    let errors = 0;

    // Process each phone number
    for (const phone of phoneNumbers) {
      try {
        const result = await wapFacade.checkWhatsAppNumber(phone, countryCode);
        results.push(result);
      } catch (error) {
        errors++;
        results.push({
          inputPhoneNumber: phone,
          error: error.message,
          exists: false
        });
      }
    }

    res.json({
      success: true,
      total: phoneNumbers.length,
      processed: results.length,
      errors,
      results
    });
  } catch (error) {
    console.error('Error in batch check:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Format a phone number (utility endpoint)
router.post('/format', (req, res) => {
  try {
    const { phoneNumber, countryCode } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    const formatted = wapFacade.formatPhoneNumber(phoneNumber, countryCode);

    res.json({
      success: true,
      original: phoneNumber,
      formatted,
      countryCode: countryCode || config.wap.defaultCountryCode
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reinitialize client if needed
router.post('/reinitialize', async (req, res) => {
  try {
    console.log('Reinitializing WhatsApp client...');
    
    // Destroy existing client
    await wapFacade.destroy();
    clientInitialized = false;
    
    // Initialize new client
    initializeClient();
    
    res.json({
      success: true,
      message: 'WhatsApp client reinitialization started'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;