const { config } = require('./wap_config');
const { formatPhoneNumber } = require('./wap_format_phone_number');

// Function to check if a number is registered on WhatsApp
async function checkWhatsAppNumber(
  phoneNumber,
  countryCode = config.defaultCountryCode,
  client
) {
  try {
    if (!client || !client.info) {
      throw new Error('WhatsApp client not ready');
    }

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

module.exports = { checkWhatsAppNumber };
