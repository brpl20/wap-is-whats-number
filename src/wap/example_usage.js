const wapFacade = require('./wap');

// Example usage of the WhatsApp Facade
async function exampleUsage() {
  try {
    // Initialize the WhatsApp client
    console.log('Initializing WhatsApp client...');
    wapFacade.initializeClient();

    // Wait for client to be ready (in production, use proper event handling)
    console.log('Waiting for client to be ready...');
    await new Promise(resolve => {
      const checkReady = setInterval(() => {
        if (wapFacade.isClientReady()) {
          clearInterval(checkReady);
          resolve();
        }
      }, 1000);
    });

    // Format a phone number
    const formattedNumber = wapFacade.formatPhoneNumber('11987654321');
    console.log('Formatted number:', formattedNumber);

    // Check if a number has WhatsApp
    const result = await wapFacade.checkWhatsAppNumber('11987654321');
    console.log('WhatsApp check result:', result);

    // Get configuration
    const config = wapFacade.getConfig();
    console.log('Current configuration:', config);

    // Clean up
    await wapFacade.destroy();
    console.log('Client destroyed successfully');

  } catch (error) {
    console.error('Error in example usage:', error);
    await wapFacade.destroy();
  }
}

// Express middleware example
const express = require('express');
const app = express();

app.get('/check/:number', wapFacade.ensureClientReady(), async (req, res) => {
  try {
    const result = await wapFacade.checkWhatsAppNumber(req.params.number);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run the example if this file is executed directly
if (require.main === module) {
  exampleUsage();
}

module.exports = { exampleUsage };