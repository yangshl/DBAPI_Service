import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { getClientIp } from '../utils/ipHelper';
import { query, getBeijingTime } from '../config/database';

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
  role?: string;
  apiId?: number;
  apiPath?: string;
  tokenPermissions?: any;
}

async function logApiAccess(
  apiId: number | null,
  userId: number | null,
  ipAddress: string,
  userAgent: string,
  requestParams: string,
  responseStatus: number,
  executionTime: number,
  status: string,
  errorMessage: string | null = null
) {
  try {
    await query(`
      INSERT INTO api_access_logs (api_id, user_id, ip_address, user_agent, request_params, response_status, execution_time, status, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [apiId, userId, ipAddress, userAgent, requestParams, responseStatus, executionTime, status, errorMessage, getBeijingTime()]);
  } catch (error) {
    logger.error('Failed to log API access:', error);
  }
}

async function updateApiCallStats(apiId: number, success: boolean, responseTime: number = 0) {
  try {
    const now = getBeijingTime();
    const today = now.split(' ')[0];
    
    if (success) {
      await query(`
        INSERT INTO api_call_stats (api_id, call_count, success_count, failure_count, avg_response_time, last_called_at, date)
        VALUES (?, 1, 1, 0, ?, ?, ?)
        ON CONFLICT(api_id, date) DO UPDATE SET
          call_count = call_count + 1,
          success_count = success_count + 1,
          avg_response_time = (avg_response_time * (call_count - 1) + ?) / call_count,
          last_called_at = ?
      `, [apiId, responseTime, now, today, responseTime, now]);
    } else {
      await query(`
        INSERT INTO api_call_stats (api_id, call_count, success_count, failure_count, avg_response_time, last_called_at, date)
        VALUES (?, 1, 0, 1, 0, ?, ?)
        ON CONFLICT(api_id, date) DO UPDATE SET
          call_count = call_count + 1,
          failure_count = failure_count + 1,
          last_called_at = ?
      `, [apiId, now, today, now]);
    }
  } catch (error) {
    logger.error('Failed to update API call stats:', error);
  }
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'default-secret';
    const decoded = jwt.verify(token, secret) as any;

    req.userId = decoded.userId;
    req.username = decoded.username;
    req.role = decoded.role;
    req.tokenPermissions = decoded.tokenPermissions || null;

    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.role || !roles.includes(req.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'default-secret';
    const decoded = jwt.verify(token, secret) as any;

    req.userId = decoded.userId;
    req.username = decoded.username;
    req.role = decoded.role;
    req.tokenPermissions = decoded.tokenPermissions || null;

    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    next();
  }
};

export const authenticateApiToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    const ipAddress = getClientIp(req);
    const userAgent = req.get('user-agent') || '';
    
    if (req.apiId) {
      await logApiAccess(
        req.apiId,
        null,
        ipAddress,
        userAgent,
        JSON.stringify(req.query),
        401,
        0,
        'failure',
        'Access token required'
      );
      await updateApiCallStats(req.apiId, false);
    }
    
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    if (token.startsWith('api_')) {
      const users = await query(
        'SELECT id, username, role, api_token, token_expires_at, token_permissions FROM users WHERE api_token = ?',
        [token]
      );

      if (users.length === 0) {
        const ipAddress = getClientIp(req);
        const userAgent = req.get('user-agent') || '';
        
        if (req.apiId) {
          await logApiAccess(
            req.apiId,
            null,
            ipAddress,
            userAgent,
            JSON.stringify(req.query),
            403,
            0,
            'failure',
            'Invalid API token'
          );
          await updateApiCallStats(req.apiId, false);
        }
        
        res.status(403).json({ error: 'Invalid API token' });
        return;
      }

      const user = users[0];
      req.userId = user.id;
      req.username = user.username;
      req.role = user.role;
      req.tokenPermissions = user.token_permissions ? JSON.parse(user.token_permissions) : null;

      if (user.token_expires_at && new Date(user.token_expires_at) < new Date()) {
        const ipAddress = getClientIp(req);
        const userAgent = req.get('user-agent') || '';
        
        if (req.apiId) {
          await logApiAccess(
            req.apiId,
            user.id,
            ipAddress,
            userAgent,
            JSON.stringify(req.query),
            403,
            0,
            'failure',
            'API token has expired'
          );
          await updateApiCallStats(req.apiId, false);
        }
        
        res.status(403).json({ error: 'API token has expired' });
        return;
      }

      next();
    } else {
      const secret = process.env.JWT_SECRET || 'default-secret';
      const decoded = jwt.verify(token, secret) as any;

      req.userId = decoded.userId;
      req.username = decoded.username;
      req.role = decoded.role;
      req.tokenPermissions = decoded.tokenPermissions || null;

      next();
    }
  } catch (error) {
    logger.error('Token verification failed:', error);
    
    const ipAddress = getClientIp(req);
    const userAgent = req.get('user-agent') || '';
    
    if (req.apiId) {
      await logApiAccess(
        req.apiId,
        null,
        ipAddress,
        userAgent,
        JSON.stringify(req.query),
        403,
        0,
        'failure',
        'Invalid or expired token'
      );
      await updateApiCallStats(req.apiId, false);
    }
    
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const optionalApiTokenAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    if (token.startsWith('api_')) {
      const users = await query(
        'SELECT id, username, role, api_token, token_expires_at, token_permissions FROM users WHERE api_token = ?',
        [token]
      );

      if (users.length === 0) {
        next();
        return;
      }

      const user = users[0];

      if (user.token_expires_at && new Date(user.token_expires_at) < new Date()) {
        next();
        return;
      }

      req.userId = user.id;
      req.username = user.username;
      req.role = user.role;
      req.tokenPermissions = user.token_permissions ? JSON.parse(user.token_permissions) : null;

      next();
    } else {
      const secret = process.env.JWT_SECRET || 'default-secret';
      const decoded = jwt.verify(token, secret) as any;

      req.userId = decoded.userId;
      req.username = decoded.username;
      req.role = decoded.role;
      req.tokenPermissions = decoded.tokenPermissions || null;

      next();
    }
  } catch (error) {
    logger.error('Token verification failed:', error);
    next();
  }
};
