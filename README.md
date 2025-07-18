# Unified API Service

This service combines a WhatsApp Number Validation API and a Brazilian CEP (Postal Code) Validator API into a single server with differentiated endpoints.

## Features

### WhatsApp Number Validation
- Check if a single phone number is registered on WhatsApp
- Validate multiple phone numbers in a single request
- Get detailed information about validation status
- Support for various phone number formats
- Automatic phone number formatting and cleaning

### CEP Validation
- Validate Brazilian postal codes (CEPs)
- Get address details for valid CEPs
- Support for both GET and POST methods
- Proper formatting and validation

## Prerequisites

- Node.js 14 or higher
- A WhatsApp account for the API to use for validation
- Internet connection to access the ViaCEP API

## Installation

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd wap-is-whats-number
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the unified server:
   ```bash
   npm start
   ```

4. For WhatsApp validation functionality, you'll need to authenticate:
   - Scan the QR code that appears in the terminal with your WhatsApp app
   - The authentication data will be saved locally for future use

## API Endpoints

### WhatsApp API Endpoints

#### Check Single Phone Number
```
POST /api/whatsapp/check
```

**Request Body:**
```json
{
  "phoneNumber": "11987654321",
  "countryCode": "55"  // Optional, defaults to config.defaultCountryCode
}
```

#### Check Multiple Phone Numbers
```
POST /api/whatsapp/check-batch
```

**Request Body:**
```json
{
  "phoneNumbers": [
    "11987654321",
    "1187654321",
    "(11) 98765-4321"
  ],
  "countryCode": "55"  // Optional
}
```

#### Check WhatsApp Service Status
```
GET /api/whatsapp/status
```

### CEP API Endpoints

#### Validate CEP (GET method)
```
GET /api/cep/validate-cep/:cep
```

**Example:**
```
GET /api/cep/validate-cep/01001000
```

#### Validate CEP (POST method)
```
POST /api/cep/validate-cep
```

**Request Body:**
```json
{
  "cep": "01001000"
}
```

#### Check CEP Service Status
```
GET /api/cep
```

### General Endpoints

#### Health Check
```
GET /health
```

#### Documentation
```
GET /
```

## Configuration

The server can be configured using environment variables:

- `PORT` - Server port (default: 3000)
- `SSL_ENABLED` - Enable SSL (default: false)
- `SSL_KEY` - Path to SSL key
- `SSL_CERT` - Path to SSL certificate
- `CHROME_PATH` - Path to Chrome executable
- `DEFAULT_COUNTRY_CODE` - Default country code for phone numbers (default: "55")
- `MAX_BATCH_SIZE` - Maximum number of phone numbers per batch request (default: 20)
- `OPERATION_TIMEOUT` - Timeout for operations in ms (default: 10000)

## Running Individual Services

If you need to run only one of the services:

```bash
# Run only the WhatsApp service
npm run start:whatsapp

# Run only the CEP service
npm run start:cep
```

## Deployment Considerations

- This service requires a persistent session to maintain the WhatsApp connection
- For production use, consider implementing API authentication
- The service saves authentication data locally, so persistent storage is needed
- Consider using process managers like PM2 to ensure the service stays running
- In containerized environments, make sure to properly mount volumes for authentication data
- When deploying to a production environment, ensure the server has adequate memory for running headless Chrome
- Set up proper rate limiting to prevent abuse of either the WhatsApp or CEP validation services

## Libraries Used

- [express](https://expressjs.com/) - Web framework
- [whatsapp-web.js](https://wwebjs.dev/) - WhatsApp Web API client
- [qrcode-terminal](https://www.npmjs.com/package/qrcode-terminal) - QR code generation
- [puppeteer](https://pptr.dev/) - Headless browser automation
- [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) - Rate limiting middleware

## Architecture

The application follows a modular architecture:

1. **Unified Server** - The main entry point that initializes and configures the Express application
2. **WhatsApp Module** - Handles WhatsApp client connection and phone number validation
3. **CEP Module** - Provides Brazilian postal code validation via the ViaCEP API
4. **Router Separation** - Each API has its own Express router with isolated endpoints

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC