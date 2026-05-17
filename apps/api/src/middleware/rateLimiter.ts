import rateLimit from 'express-rate-limit';

// Applied globally to all routes in index.ts
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true, // sends RateLimit headers in response
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Login — strict, small window, brute force target
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again in 15 minutes' },
});

// Register — slightly more lenient
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts created, please try again later' },
});

// Refresh — happens frequently (every 15min per active user)
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many refresh attempts' },
});
