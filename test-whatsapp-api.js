/**
 * Test script for WhatsApp number validation API
 *
 * This script sends various test requests to the WhatsApp validation API
 * to test different phone number formats and endpoint behaviors.
 */

const axios = require('axios');

// API base URL - adjust as needed for your environment
const API_BASE_URL = 'http://localhost:3000';

// Test data: Various phone number formats to test with
const testPhoneNumbers = [
  // Valid formats (fictional numbers)
  '11987654321',              // Standard Brazilian mobile (11 digits with 9)
  '1187654321',               // Older format without 9 (10 digits)
  '(11) 98765-4321',          // Formatted with symbols
  '11 9 8765 4321',           // Formatted with spaces
  '5511987654321',            // With country code included
  '+55 (11) 98765-4321',      // International format with symbols

  // Edge cases
  '',                         // Empty string
  null,                       // Null value
  '123',                      // Too short
  '1234567890123456',         // Too long
  '11a87b65c43d21',           // With letters mixed in
  '55119876543210',           // Extra digits
];

// Console color constants for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Logs a colored message to the console
 * @param {string} message - The message to log
 * @param {string} color - The color to use
 */
function logMessage(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Logs a section header
 * @param {string} title - The section title
 */
function logSection(title) {
  console.log('\n' + colors.bright + colors.blue + '='.repeat(80) + colors.reset);
  console.log(colors.bright + colors.blue + ` ${title} ` + colors.reset);
  console.log(colors.bright + colors.blue + '='.repeat(80) + colors.reset + '\n');
}

/**
 * Tests the health check endpoint
 */
async function testHealthCheck() {
  logSection('Testing Health Check Endpoint');

  try {
    const response = await axios.get(`${API_BASE_URL}/getStatus`);
    logMessage(`Status: ${response.status}`, colors.green);
    logMessage('Response:', colors.cyan);
    console.log(response.data);
  } catch (error) {
    logMessage(`Error: ${error.message}`, colors.red);
    if (error.response) {
      logMessage('Response data:', colors.red);
      console.log(error.response.data);
    }
  }
}

/**
 * Tests the single phone number validation endpoint
 */
async function testSinglePhoneValidation() {
  logSection('Testing Single Phone Number Validation');

  for (const phoneNumber of testPhoneNumbers) {
    logMessage(`\nTesting phone number: "${phoneNumber}"`, colors.yellow);

    try {
      const response = await axios.post(`${API_BASE_URL}/checkSingleWhatsApp`, {
        phoneNumber
      });

      logMessage(`Status: ${response.status}`, colors.green);
      logMessage('Response:', colors.cyan);
      console.log(response.data);
    } catch (error) {
      logMessage(`Error: ${error.message}`, colors.red);
      if (error.response) {
        logMessage(`Status: ${error.response.status}`, colors.red);
        logMessage('Response data:', colors.red);
        console.log(error.response.data);
      }
    }
  }
}

/**
 * Tests the multiple phone numbers validation endpoint
 */
async function testMultiplePhoneValidation() {
  logSection('Testing Multiple Phone Numbers Validation');

  try {
    const response = await axios.post(`${API_BASE_URL}/checkWhatsApp`, {
      phoneNumbers: testPhoneNumbers
    });

    logMessage(`Status: ${response.status}`, colors.green);
    logMessage('Response:', colors.cyan);
    console.log(response.data);
  } catch (error) {
    logMessage(`Error: ${error.message}`, colors.red);
    if (error.response) {
      logMessage(`Status: ${error.response.status}`, colors.red);
      logMessage('Response data:', colors.red);
      console.log(error.response.data);
    }
  }
}

/**
 * Tests invalid input to multiple phone validation endpoint
 */
async function testInvalidInput() {
  logSection('Testing Invalid Input');

  const testCases = [
    { description: 'String instead of array', data: { phoneNumbers: 'not an array' } },
    { description: 'Missing phoneNumbers field', data: { wrongField: [] } },
    { description: 'Empty object', data: {} },
    { description: 'Array with mixed types', data: { phoneNumbers: ['11987654321', 123, true, {}] } }
  ];

  for (const testCase of testCases) {
    logMessage(`\nTest case: ${testCase.description}`, colors.yellow);

    try {
      const response = await axios.post(`${API_BASE_URL}/checkWhatsApp`, testCase.data);

      logMessage(`Status: ${response.status}`, colors.green);
      logMessage('Response:', colors.cyan);
      console.log(response.data);
    } catch (error) {
      logMessage(`Error: ${error.message}`, colors.red);
      if (error.response) {
        logMessage(`Status: ${error.response.status}`, colors.red);
        logMessage('Response data:', colors.red);
        console.log(error.response.data);
      }
    }
  }
}

/**
 * Tests a large batch of phone numbers
 */
async function testLargeBatch() {
  logSection('Testing Large Batch of Phone Numbers');

  // Generate a larger array of 100 phone numbers
  const largeBatch = Array.from({ length: 100 }, (_, i) => {
    // Create variations by changing the last 5 digits
    const index = i.toString().padStart(5, '0');
    return `1198765${index}`;
  });

  try {
    console.time('Large Batch Processing Time');
    const response = await axios.post(`${API_BASE_URL}/checkWhatsApp`, {
      phoneNumbers: largeBatch
    });
    console.timeEnd('Large Batch Processing Time');

    logMessage(`Status: ${response.status}`, colors.green);
    logMessage(`Received ${response.data.length} results`, colors.cyan);

    // Only show first 5 results to avoid console clutter
    logMessage('First 5 results:', colors.cyan);
    console.log(response.data.slice(0, 5));
  } catch (error) {
    logMessage(`Error: ${error.message}`, colors.red);
    if (error.response) {
      logMessage(`Status: ${error.response.status}`, colors.red);
      logMessage('Response data:', colors.red);
      console.log(error.response.data);
    }
  }
}

/**
 * Main function to run all tests
 */
async function runTests() {
  logMessage('WhatsApp API Test Suite', colors.bright + colors.green);
  logMessage(`Testing against: ${API_BASE_URL}\n`, colors.cyan);

  try {
    // Run all test functions
    await testHealthCheck();
    await testSinglePhoneValidation();
    await testMultiplePhoneValidation();
    await testInvalidInput();
    await testLargeBatch();

    logMessage('\nAll tests completed!', colors.bright + colors.green);
  } catch (error) {
    logMessage(`\nTest suite failed: ${error.message}`, colors.bright + colors.red);
  }
}

// Run the tests
runTests();
