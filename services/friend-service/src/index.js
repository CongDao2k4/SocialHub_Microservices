if (process.env.ENVIRONMENT === 'production') {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

import express from "express";
import dotenv from "dotenv";

import friendRoutes from "./routes/friend.route.js";
import { initDatabase } from "./config/db.js";

dotenv.config();

const app = express();

// Disable ETag generation to prevent 304 Not Modified responses
app.set('etag', false);

app.use(express.json());

// Custom HTTP Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Cache Control Middleware to prevent client caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use("/api/friends", friendRoutes);

const PORT = process.env.PORT || 5002;

await initDatabase();

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "friend-service" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Global error in Friend Service:", err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.name || "InternalServerError",
    message: err.message || "An unexpected error occurred in Friend Service"
  });
});

app.listen(PORT, () => {
    console.log("Server is running on port: ", PORT);
});