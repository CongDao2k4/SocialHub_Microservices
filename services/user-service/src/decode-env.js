import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Automatically decode environment variables prefixed with "base64:"
for (const key in process.env) {
  if (process.env[key] && process.env[key].startsWith('base64:')) {
    try {
      const encodedValue = process.env[key].slice(7);
      const decodedValue = Buffer.from(encodedValue, 'base64').toString('utf8');
      process.env[key] = decodedValue;
    } catch (err) {
      console.error(`[ERROR] Failed to decode base64 environment variable ${key}:`, err.message);
    }
  }
}
