# Unified API Documentation

## Overview
This is a unified API service that provides WhatsApp number validation and Brazilian CEP (postal code) validation services.

## Base URL
```
http://localhost:3000
```

## Services

### 1. WhatsApp Number Validation API (`/api/wap`)

#### Get Service Status
```http
GET /api/wap/status
```

**Response:**
```json
{
  "success": true,
  "status": {
    "initialized": true,
    "ready": true,
    "state": "CONNECTED"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Check Single Number
```http
POST /api/wap/check
Content-Type: application/json

{
  "phoneNumber": "11987654321",
  "countryCode": "55"  // Optional, defaults to 55 (Brazil)
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "inputPhoneNumber": "11987654321",
    "formattedPhoneNumber": "5511987654321",
    "exists": true
  }
}
```

#### Check Multiple Numbers (Batch)
```http
POST /api/wap/check/batch
Content-Type: application/json

{
  "phoneNumbers": ["11987654321", "11912345678"],
  "countryCode": "55"
}
```

**Response:**
```json
{
  "success": true,
  "total": 2,
  "processed": 2,
  "errors": 0,
  "results": [
    {
      "inputPhoneNumber": "11987654321",
      "formattedPhoneNumber": "5511987654321",
      "exists": true
    },
    {
      "inputPhoneNumber": "11912345678",
      "formattedPhoneNumber": "5511912345678",
      "exists": false
    }
  ]
}
```

#### Format Phone Number
```http
POST /api/wap/format
Content-Type: application/json

{
  "phoneNumber": "11987654321",
  "countryCode": "55"
}
```

**Response:**
```json
{
  "success": true,
  "original": "11987654321",
  "formatted": "5511987654321",
  "countryCode": "55"
}
```

#### Reinitialize WhatsApp Client
```http
POST /api/wap/reinitialize
```

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp client reinitialization started"
}
```

### 2. CEP Validation API (`/api/cep`)

#### Get Service Status
```http
GET /api/cep/status
```

**Response:**
```json
{
  "success": true,
  "service": "CEP Validator",
  "status": "active",
  "provider": "ViaCEP",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Validate CEP (GET)
```http
GET /api/cep/validate/01310100
```

**Response:**
```json
{
  "success": true,
  "isValid": true,
  "message": "Valid CEP",
  "cep": "01310100",
  "data": {
    "cep": "01310-100",
    "street": "Avenida Paulista",
    "complement": "de 612 a 1510 - lado par",
    "neighborhood": "Bela Vista",
    "city": "São Paulo",
    "state": "SP",
    "ibge": "3550308",
    "gia": "1004",
    "ddd": "11",
    "siafi": "7107"
  }
}
```

#### Validate CEP (POST)
```http
POST /api/cep/validate
Content-Type: application/json

{
  "cep": "01310-100"
}
```

#### Validate Multiple CEPs (Batch)
```http
POST /api/cep/validate/batch
Content-Type: application/json

{
  "ceps": ["01310100", "01001000", "99999999"]
}
```

**Response:**
```json
{
  "success": true,
  "total": 3,
  "valid": 2,
  "invalid": 1,
  "results": [
    {
      "isValid": true,
      "message": "Valid CEP",
      "cep": "01310100",
      "data": { ... }
    },
    {
      "isValid": true,
      "message": "Valid CEP",
      "cep": "01001000",
      "data": { ... }
    },
    {
      "isValid": false,
      "message": "Invalid CEP",
      "cep": "99999999"
    }
  ]
}
```

#### Format CEP
```http
POST /api/cep/format
Content-Type: application/json

{
  "cep": "01310100"
}
```

**Response:**
```json
{
  "success": true,
  "original": "01310100",
  "clean": "01310100",
  "formatted": "01310-100"
}
```

### 3. General Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "services": {
    "wap": "active",
    "cep": "active"
  }
}
```

#### API Information
```http
GET /
```

**Response:**
```json
{
  "name": "Unified API Service",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "wap": { ... },
    "cep": { ... }
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Phone number is required"
}
```

### 503 Service Unavailable
```json
{
  "success": false,
  "error": "WhatsApp client not ready yet. Please try again later."
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| DEFAULT_COUNTRY_CODE | 55 | Default country code for WhatsApp |
| MAX_BATCH_SIZE | 20 | Maximum numbers in batch operations |
| WAP_SESSION_PATH | ./sessions | WhatsApp session storage path |
| CEP_TIMEOUT | 5000 | CEP API timeout in milliseconds |
| CORS_ORIGIN | * | CORS allowed origins |
| CORS_CREDENTIALS | false | Enable CORS credentials |

## Starting the Server

### Using the startup script:
```bash
cd src/api
./start.sh
```

### Using Node directly:
```bash
cd src/api
node index.js
```

### Using npm from project root:
```bash
npm run api
```

## Notes

- The WhatsApp client needs to be authenticated by scanning a QR code on first run
- Session data is persisted in the `sessions` directory
- CEP validation uses the ViaCEP public API
- Both services support batch operations with configurable limits