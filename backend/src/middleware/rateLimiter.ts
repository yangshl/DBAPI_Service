import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
  message: {
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    
    if (typeof forwarded === 'string') {
      const ips = forwarded.split(',').map(ip => ip.trim());
      return ips[0];
    }
    
    if (typeof realIp === 'string') {
      return realIp.trim();
    }
    
    return req.ip || 'unknown';
  }
});

export const loginRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX_REQUESTS || '20'),
  message: {
    error: 'Too many login attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    
    if (typeof forwarded === 'string') {
      const ips = forwarded.split(',').map(ip => ip.trim());
      return ips[0];
    }
    
    if (typeof realIp === 'string') {
      return realIp.trim();
    }
    
    return req.ip || 'unknown';
  }
});
