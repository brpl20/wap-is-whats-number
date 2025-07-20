module.exports = {
  apps: [
    {
      name: "whatsapp-api",
      script: "./app.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3003,
        HOST: "0.0.0.0",
      },
      error_file: "./logs/wap-err.log",
      out_file: "./logs/wap-out.log",
      log_file: "./logs/wap-combined.log",
      time: true,
    },
  ],
};
