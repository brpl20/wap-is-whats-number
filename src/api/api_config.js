// Simple configuration
const config = {
  port: process.env.PORT || 3000,
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || "20", 10),
};
