# WhatsApp Number Validation API

A lightweight server-side API that checks if phone numbers are registered on WhatsApp. This service provides a simple way to validate phone numbers before attempting to send messages to them.

## Features

- Check if a single phone number is registered on WhatsApp
- Validate multiple phone numbers in a single request
- Health check endpoint to verify service status
- Support for various phone number formats
- Automatic phone number formatting and cleaning
- Proper error handling and response formatting

## Prerequisites

- Node.js 14 or higher
- A WhatsApp account for the API to use for validation

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

3. Start the server:
   ```bash
   npm start
   ```

4. The first time you run the server, you'll need to authenticate with WhatsApp:
   - Scan the QR code that appears in the terminal with your WhatsApp app
   - The authentication data will be saved locally for future use

## API Endpoints

### Check Service Status

```
GET /getStatus
```

**Response:**
```json
{
  "success": true,
  "status": "CONNECTED",
  "clientInfo": {
    "name": "YourWhatsAppName",
    "phone": "12345678901",
    "connected": true
  }
}
```

### Check Single Phone Number

```
POST /checkSingleWhatsApp
```

**Request Body:**
```json
{
  "phoneNumber": "11987654321",
  "countryCode": "55"  // Optional, defaults to "55" (Brazil)
}
```

**Response:**
```json
{
  "phoneNumber": "11987654321",
  "formattedNumber": "5511987654321@c.us",
  "isValidWhatsApp": true
}
```

### Check Multiple Phone Numbers

```
POST /checkWhatsApp
```

**Request Body:**
```json
{
  "phoneNumbers": [
    "11987654321",
    "1187654321",
    "(11) 98765-4321"
  ],
  "countryCode": "55"  // Optional, defaults to "55" (Brazil)
}
```

**Response:**
```json
[
  {
    "phone": "11987654321",
    "formattedNumber": "5511987654321@c.us",
    "isValidWhatsApp": true
  },
  {
    "phone": "1187654321",
    "formattedNumber": "551187654321@c.us",
    "isValidWhatsApp": false
  },
  {
    "phone": "(11) 98765-4321",
    "formattedNumber": "5511987654321@c.us",
    "isValidWhatsApp": true
  }
]
```

## Testing

This project includes a comprehensive test script that validates the API with various phone number formats:

```bash
npm test
```

The test script will check:
- Service health status
- Single phone number validation with various formats
- Multiple phone numbers validation
- Invalid input handling
- Large batch performance

## Deployment Considerations

- This service requires a persistent session to maintain the WhatsApp connection
- For production use, consider implementing API authentication
- The service saves authentication data locally, so persistent storage is needed
- Consider using process managers like PM2 to ensure the service stays running
- In containerized environments, make sure to properly mount volumes for authentication data

## Libraries Used

- [express](https://expressjs.com/) - Web framework
- [whatsapp-web.js](https://wwebjs.dev/) - WhatsApp Web API client
- [qrcode-terminal](https://www.npmjs.com/package/qrcode-terminal) - QR code generation

## License

ISC