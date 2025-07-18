const express = require('express')
const https = require('https')
const app = express()
const port = 3001

// Middleware to parse JSON requests
app.use(express.json())

// Setup CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  )
  next()
})

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'CEP Validator API is running' })
})

/**
 * Validates a Brazilian CEP (ZIP code) by calling the ViaCEP API
 * @param {string} cep - The CEP to validate (numbers only)
 * @returns {Promise} - Promise that resolves with the validation result
 */
function validateCEP(cep) {
  return new Promise((resolve, reject) => {
    // Basic format validation
    const cleanCep = cep.replace(/[^0-9]/g, '')

    if (cleanCep.length !== 8) {
      return resolve({
        isValid: false,
        message: 'CEP must have 8 digits',
        cep: cleanCep
      })
    }

    // Call the ViaCEP API
    const url = `https://viacep.com.br/ws/${cleanCep}/json/`

    https
      .get(url, (response) => {
        let data = ''

        // A chunk of data has been received
        response.on('data', (chunk) => {
          data += chunk
        })

        // The whole response has been received
        response.on('end', () => {
          try {
            const result = JSON.parse(data)

            if (result.erro) {
              resolve({
                isValid: false,
                message: 'Invalid CEP',
                cep: cleanCep
              })
            } else {
              resolve({
                isValid: true,
                message: 'Valid CEP',
                cep: cleanCep,
                data: result
              })
            }
          } catch (error) {
            reject({
              isValid: false,
              message: 'Error processing response',
              error: error.message
            })
          }
        })
      })
      .on('error', (error) => {
        reject({
          isValid: false,
          message: 'Error calling ViaCEP API',
          error: error.message
        })
      })
  })
}

// CEP validation endpoint - GET method
app.get('/validate-cep/:cep', async (req, res) => {
  try {
    const cepValue = req.params.cep
    const result = await validateCEP(cepValue)
    res.json(result)
  } catch (error) {
    res.status(500).json({
      isValid: false,
      message: 'Server error',
      error: error.message
    })
  }
})

// CEP validation endpoint - POST method
app.post('/validate-cep', async (req, res) => {
  try {
    const { cep } = req.body

    if (!cep) {
      return res.status(400).json({
        isValid: false,
        message: 'CEP is required in the request body'
      })
    }

    const result = await validateCEP(cep)
    res.json(result)
  } catch (error) {
    res.status(500).json({
      isValid: false,
      message: 'Server error',
      error: error.message
    })
  }
})

// Start the server
app.listen(port, () => {
  console.log(`CEP Validator API running at http://localhost:${port}`)
})
