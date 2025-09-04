const express = require('express');
const https = require('https');
const router = express.Router();
const config = require('../config');

/**
 * Validates a Brazilian CEP (ZIP code) by calling the ViaCEP API
 * @param {string} cep - The CEP to validate (numbers only)
 * @returns {Promise} - Promise that resolves with the validation result
 */
function validateCEP(cep) {
  return new Promise((resolve, reject) => {
    // Basic format validation
    const cleanCep = cep.replace(/[^0-9]/g, '');

    if (cleanCep.length !== 8) {
      return resolve({
        isValid: false,
        message: 'CEP must have 8 digits',
        cep: cleanCep
      });
    }

    // Call the ViaCEP API
    const url = `${config.cep.apiUrl}/${cleanCep}/json/`;

    const request = https.get(url, (response) => {
      let data = '';

      // Set timeout for the request
      response.setTimeout(config.cep.timeout);

      // A chunk of data has been received
      response.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received
      response.on('end', () => {
        try {
          const result = JSON.parse(data);

          if (result.erro) {
            resolve({
              isValid: false,
              message: 'Invalid CEP',
              cep: cleanCep
            });
          } else {
            resolve({
              isValid: true,
              message: 'Valid CEP',
              cep: cleanCep,
              data: {
                cep: result.cep,
                street: result.logradouro,
                complement: result.complemento,
                neighborhood: result.bairro,
                city: result.localidade,
                state: result.uf,
                ibge: result.ibge,
                gia: result.gia,
                ddd: result.ddd,
                siafi: result.siafi
              }
            });
          }
        } catch (error) {
          reject({
            isValid: false,
            message: 'Error processing response',
            error: error.message
          });
        }
      });

      response.on('timeout', () => {
        request.abort();
        reject({
          isValid: false,
          message: 'Request timeout',
          error: 'ViaCEP API request timed out'
        });
      });
    });

    request.on('error', (error) => {
      reject({
        isValid: false,
        message: 'Error calling ViaCEP API',
        error: error.message
      });
    });

    request.setTimeout(config.cep.timeout, () => {
      request.abort();
      reject({
        isValid: false,
        message: 'Request timeout',
        error: 'ViaCEP API request timed out'
      });
    });
  });
}

// CEP status/health check
router.get('/status', (req, res) => {
  res.json({
    success: true,
    service: 'CEP Validator',
    status: 'active',
    provider: 'ViaCEP',
    timestamp: new Date().toISOString()
  });
});

// CEP validation - GET method
router.get('/validate/:cep', async (req, res) => {
  try {
    const cepValue = req.params.cep;
    const result = await validateCEP(cepValue);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      isValid: false,
      message: 'Server error',
      error: error.message || error.error
    });
  }
});

// CEP validation - POST method
router.post('/validate', async (req, res) => {
  try {
    const { cep } = req.body;

    if (!cep) {
      return res.status(400).json({
        success: false,
        isValid: false,
        message: 'CEP is required in the request body'
      });
    }

    const result = await validateCEP(cep);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      isValid: false,
      message: 'Server error',
      error: error.message || error.error
    });
  }
});

// Batch CEP validation
router.post('/validate/batch', async (req, res) => {
  try {
    const { ceps } = req.body;

    if (!ceps || !Array.isArray(ceps)) {
      return res.status(400).json({
        success: false,
        error: 'CEPs array is required'
      });
    }

    if (ceps.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'CEPs array cannot be empty'
      });
    }

    if (ceps.length > config.maxBatchSize) {
      return res.status(400).json({
        success: false,
        error: `Batch size exceeds maximum limit of ${config.maxBatchSize}`
      });
    }

    const results = [];
    let validCount = 0;
    let invalidCount = 0;

    // Process each CEP
    for (const cep of ceps) {
      try {
        const result = await validateCEP(cep);
        if (result.isValid) {
          validCount++;
        } else {
          invalidCount++;
        }
        results.push(result);
      } catch (error) {
        invalidCount++;
        results.push({
          isValid: false,
          cep: cep,
          message: 'Error validating CEP',
          error: error.message || error.error
        });
      }
    }

    res.json({
      success: true,
      total: ceps.length,
      valid: validCount,
      invalid: invalidCount,
      results
    });
  } catch (error) {
    console.error('Error in batch CEP validation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Format CEP (utility endpoint)
router.post('/format', (req, res) => {
  try {
    const { cep } = req.body;

    if (!cep) {
      return res.status(400).json({
        success: false,
        error: 'CEP is required'
      });
    }

    const cleanCep = cep.replace(/[^0-9]/g, '');
    
    if (cleanCep.length !== 8) {
      return res.status(400).json({
        success: false,
        error: 'CEP must have 8 digits'
      });
    }

    const formatted = cleanCep.replace(/(\d{5})(\d{3})/, '$1-$2');

    res.json({
      success: true,
      original: cep,
      clean: cleanCep,
      formatted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;