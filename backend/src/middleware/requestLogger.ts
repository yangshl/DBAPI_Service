import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { getClientIp } from '../utils/ipHelper';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: getClientIp(req)
    });
  });

  next();
};
