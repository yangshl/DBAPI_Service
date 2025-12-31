import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
  role?: string;
}

export async function checkPermission(permissionCode: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRole = req.role;

      if (!userRole) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const sql = `
        SELECT p.* 
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role = ? AND p.code = ? AND p.status = ?
      `;
      const permission = await query(sql, [userRole, permissionCode, 'active']);

      if (permission.length === 0) {
        logger.warn(`Permission denied: ${permissionCode} for user ${req.username} with role ${userRole}`);
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      res.status(500).json({ error: 'Failed to check permission' });
    }
  };
}

export async function checkAnyPermission(permissionCodes: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRole = req.role;

      if (!userRole) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const placeholders = permissionCodes.map(() => '?').join(',');
      const sql = `
        SELECT p.* 
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role = ? AND p.code IN (${placeholders}) AND p.status = ?
      `;
      const permission = await query(sql, [userRole, ...permissionCodes, 'active']);

      if (permission.length === 0) {
        logger.warn(`Permission denied: any of [${permissionCodes.join(', ')}] for user ${req.username} with role ${userRole}`);
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      res.status(500).json({ error: 'Failed to check permission' });
    }
  };
}

export async function checkResourcePermission(resource: string, action: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRole = req.role;

      if (!userRole) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const sql = `
        SELECT p.* 
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role = ? AND p.resource = ? AND p.action = ? AND p.status = ?
      `;
      const permission = await query(sql, [userRole, resource, action, 'active']);

      if (permission.length === 0) {
        logger.warn(`Permission denied: ${resource}:${action} for user ${req.username} with role ${userRole}`);
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      res.status(500).json({ error: 'Failed to check permission' });
    }
  };
}

export async function getUserPermissions(role: string): Promise<string[]> {
  try {
    const sql = `
      SELECT p.code 
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role = ? AND p.status = ?
    `;
    const permissions = await query(sql, [role, 'active']);
    return permissions.map((p: any) => p.code);
  } catch (error) {
    logger.error('Get user permissions error:', error);
    return [];
  }
}
