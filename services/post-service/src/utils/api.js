import axios from 'axios';
import { redisClient } from '../config/redis.js';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:5000';
const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || 'http://media-service:5000';

/**
 * Fetch user profile from user-service, with Redis caching
 * @param {string} userId
 * @param {string} token - JWT token from request header
 * @returns {Promise<Object>} User profile
 */
export const getUserProfile = async (userId, token) => {
  const cacheKey = `user:${userId}`;
  
  try {
    // 1. Try to get from cache
    const cachedUser = await redisClient.get(cacheKey);
    if (cachedUser) {
      return JSON.parse(cachedUser);
    }

    // 2. Fetch from user-service
    // user-service route: GET /api/users/:id (protected route, needs token)
    const response = await axios.get(`${USER_SERVICE_URL}/api/users/${userId}`, {
      headers: {
        Authorization: token // Forward the JWT token
      }
    });

    const userProfile = response.data.user;

    // 3. Save to cache with TTL = 30 minutes
    if (userProfile) {
      await redisClient.setex(cacheKey, 1800, JSON.stringify({
        id: userProfile.id,
        displayName: userProfile.displayName,
        avatarUrl: userProfile.avatarUrl
      }));
      return userProfile;
    }
  } catch (error) {
    console.error(`❌ Error fetching user profile for ${userId}:`, error.message);
  }

  // Return a fallback if fetching fails
  return {
    id: userId,
    displayName: 'Unknown User',
    avatarUrl: null
  };
};

/**
 * Validate media IDs by checking with media-service
 * We use an internal HEAD or GET request to verify the media exists.
 * @param {string[]} mediaIds
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export const validateMediaIds = async (mediaIds, token) => {
  if (!mediaIds || mediaIds.length === 0) return true;

  try {
    // For now, we will assume media-service has an endpoint `GET /media/:id`
    // If not, at least we just verify format here or do a basic loop.
    // To be efficient, we can check all concurrently.
    const checks = mediaIds.map(id => 
      axios.get(`${MEDIA_SERVICE_URL}/media/${id}`, {
        headers: { Authorization: token }
      }).then(() => true).catch(() => false)
    );

    const results = await Promise.all(checks);
    // If any media fails validation, return false
    return results.every(res => res === true);
  } catch (error) {
    console.error(`❌ Error validating media IDs:`, error.message);
    return false; // Safest is to return false if validation fails
  }
};
