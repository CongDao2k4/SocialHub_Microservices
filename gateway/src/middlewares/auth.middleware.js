import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import redis from '../config/redis.js';

export const protectRoute = async (req, res, next) => {
  try {
    let token;

    // Check token in Header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token missing'
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);

    if (decoded.jti) {
      const isBlacklisted = await redis.get(`blacklist:${decoded.jti}`);

      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          message: 'Token has expired or logged out'
        });
      }
    }

    // Inject decoded info into request
    req.user = {
      id: decoded.id,
      jti: decoded.jti,
      exp: decoded.exp,
      token
    };

    next();
  } catch (error) {
    console.error('[ERROR] Error in Gateway Auth Middleware:', error.message);

    return res.status(401).json({
      success: false,
      message: 'Not authorized, invalid token'
    });
  }
};
