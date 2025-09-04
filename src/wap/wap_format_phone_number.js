const { config } = require('./wap_config');

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

module.exports = { formatPhoneNumber };
