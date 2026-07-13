import axios from 'axios';
import CircuitBreaker from 'opossum';
import {config} from '../config/index.js';

// Default options for circuit breakers
const breakerOptions = {
  timeout: config.CIRCUIT_BREAKER_TIMEOUT,
  errorThresholdPercentage: config.CIRCUIT_BREAKER_ERROR_THRESHOLD,
  resetTimeout: config.CIRCUIT_BREAKER_RESET_TIMEOUT
};

/**
 * Perform a proxy request to a downstream service.
 * @param {string} serviceName name of the service (for logging)
 * @param {string} baseUrl base URL of the service (e.g. http://user-service:5000)
 * @param {import('express').Request} req Express request
 * @param {import('express').Response} res Express response
 * @param {string} targetPath path to request (e.g. /api/users/123)
 */
async function proxyRequest(serviceName, baseUrl, req, res, targetPath) {
  const targetUrl = `${baseUrl}${targetPath}`;

  const headers = {...req.headers};
  delete headers.host;

  if (req.user && req.user.id) {
    headers['x-user-id'] = req.user.id;
    if (req.user.jti) {
      headers['x-user-jti'] = req.user.jti;
    }
  }

  const requestConfig = {
    method: req.method,
    url: targetUrl,
    headers: headers,
    params: req.query,
    responseType: 'stream',
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: () => true
  };

  // Only forward body stream for methods that traditionally have a body
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    requestConfig.data = req;
  }

  // Forward the request using Axios
  const response = await axios(requestConfig);

  const ignoredHeaders = [
    'connection',
    'content-length',
    'transfer-encoding',
    'access-control-allow-origin',
    'access-control-allow-methods',
    'access-control-allow-headers',
    'access-control-allow-credentials',
    'access-control-expose-headers',
    'access-control-max-age'
  ];

  Object.keys(response.headers).forEach((key) => {
    if (!ignoredHeaders.includes(key.toLowerCase())) {
      res.setHeader(key, response.headers[key]);
    }
  });

  res.status(response.status);
  response.data.pipe(res);

  return new Promise((resolve, reject) => {
    response.data.on('end', resolve);
    response.data.on('error', reject);
  });
}

// Circuit Breaker for User Service
const userServiceBreaker = new CircuitBreaker(
  (req, res, targetPath) => proxyRequest('user-service', config.USER_SERVICE_URL, req, res, targetPath),
  breakerOptions
);

// Create a Circuit Breaker for Media Service
const mediaServiceBreaker = new CircuitBreaker(
  (req, res, targetPath) => proxyRequest('media-service', config.MEDIA_SERVICE_URL, req, res, targetPath),
  breakerOptions
);

// Create a Circuit Breaker for Post Service
const postServiceBreaker = new CircuitBreaker(
  (req, res, targetPath) => proxyRequest('post-service', config.POST_SERVICE_URL, req, res, targetPath),
  breakerOptions
);

// Create a Circuit Breaker for Friend Service
const friendServiceBreaker = new CircuitBreaker(
  (req, res, targetPath) => proxyRequest('friend-service', config.FRIEND_SERVICE_URL, req, res, targetPath),
  breakerOptions
);

// Create a Circuit Breaker for Notification Service
const notificationServiceBreaker = new CircuitBreaker(
  (req, res, targetPath) => proxyRequest('notification-service', config.NOTIFICATION_SERVICE_URL, req, res, targetPath),
  breakerOptions
);
// Create a Circuit Breaker for Chat Service
const chatServiceBreaker = new CircuitBreaker(
  (req, res, targetPath) => proxyRequest('chat-service', config.CHAT_SERVICE_URL, req, res, targetPath),
  breakerOptions
);

// Fallback handlers
function handleFallback(serviceName, res, error) {
  console.error(`[ERROR] Circuit Breaker Triggered or Error occurred for ${serviceName}:`, error.message);

  if (res.headersSent) {
    console.warn(`[WARN] Headers already sent for ${serviceName}, destroying response stream to prevent crash.`);
    res.destroy();
    return;
  }

  res.status(503).json({
    success: false,
    error: 'Service Temporarily Unavailable',
    message: `The ${serviceName} is currently unavailable or experiencing high failure rates. Please try again later.`,
    details: config.ENVIRONMENT === 'development' ? error.message : undefined
  });
}

userServiceBreaker.fallback((req, res, targetPath, error) => handleFallback('user-service', res, error));
mediaServiceBreaker.fallback((req, res, targetPath, error) => handleFallback('media-service', res, error));
postServiceBreaker.fallback((req, res, targetPath, error) => handleFallback('post-service', res, error));
friendServiceBreaker.fallback((req, res, targetPath, error) => handleFallback('friend-service', res, error));
notificationServiceBreaker.fallback((req, res, targetPath, error) => handleFallback('notification-service', res, error));
chatServiceBreaker.fallback((req, res, targetPath, error) => handleFallback('chat-service', res, error));

// Event listeners for monitoring/debugging
[
  {name: 'user-service', breaker: userServiceBreaker},
  {name: 'media-service', breaker: mediaServiceBreaker},
  {name: 'post-service', breaker: postServiceBreaker},
  {name: 'friend-service', breaker: friendServiceBreaker},
  {name: 'notification-service', breaker: notificationServiceBreaker},
  {name: 'chat-service', breaker: chatServiceBreaker}
].forEach(({name, breaker}) => {
  breaker.on('open', () => console.warn(`[INFO] Circuit Breaker [OPEN] for service: ${name}`));
  breaker.on('halfOpen', () => console.log(`[INFO] Circuit Breaker [HALF-OPEN] for service: ${name}`));
  breaker.on('close', () => console.log(`[INFO] Circuit Breaker [CLOSED] for service: ${name}`));
});

export const httpClientService = {
  forwardToUserService: (req, res, targetPath) => userServiceBreaker.fire(req, res, targetPath),
  forwardToMediaService: (req, res, targetPath) => mediaServiceBreaker.fire(req, res, targetPath),
  forwardToPostService: (req, res, targetPath) => postServiceBreaker.fire(req, res, targetPath),
  forwardToFriendService: (req, res, targetPath) => friendServiceBreaker.fire(req, res, targetPath),
  forwardToNotificationService: (req, res, targetPath) => notificationServiceBreaker.fire(req, res, targetPath),
  forwardToChatService: (req, res, targetPath) => chatServiceBreaker.fire(req, res, targetPath)
};
