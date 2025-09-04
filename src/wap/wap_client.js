// simple method
const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const wapFacade = require('./wap');

// Global client variable (for backward compatibility)
let client = null;

// Start the application (simplified)
function startApplication() {
  console.log("Initializing WhatsApp client...");

  // Initialize the client using the facade
  client = wapFacade.initializeClient();
  console.log("WhatsApp client initialized");

  // Note: Server creation code should be added here if needed
  // const app = express();
  // const server = http.createServer(app);

  // Handle graceful shutdown
  const gracefulShutdown = async () => {
    console.log("\nShutdown signal received. Shutting down gracefully...");
    try {
      console.log("Closing WhatsApp client...");
      await wapFacade.destroy();
      // If server exists, close it here
      // server.close(() => {
      //   console.log("Server closed");
      //   process.exit(0);
      // });
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  // Handle SIGINT (Ctrl+C)
  process.on("SIGINT", gracefulShutdown);

  // Handle SIGTERM
  process.on("SIGTERM", gracefulShutdown);
}

// Start the application
startApplication();

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
  console.error("Uncaught Exception:", error);
  try {
    await wapFacade.destroy();
  } catch (destroyError) {
    console.error("Error destroying client:", destroyError);
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  try {
    await wapFacade.destroy();
  } catch (destroyError) {
    console.error("Error destroying client:", destroyError);
  }
  process.exit(1);
});
