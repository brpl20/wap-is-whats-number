module.exports = {
  port: process.env.PORT || 3000,
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '20', 10),
  wap: {
    defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '55',
    sessionPath: process.env.WAP_SESSION_PATH || './sessions'
  },
  cep: {
    apiUrl: 'https://viacep.com.br/ws',
    timeout: parseInt(process.env.CEP_TIMEOUT || '5000', 10)
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true'
  }
};