import { Router, Response } from 'express';
import { query, getBeijingTime } from '../config/database';
import { logger } from '../utils/logger';
import { authenticateToken, AuthRequest, authorizeRoles } from '../middleware/auth';
import { getClientIp } from '../utils/ipHelper';

const router = Router();

router.use(authenticateToken);

router.get('/', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, status } = req.query;

    let sql = 'SELECT * FROM permissions WHERE 1=1';
    const params: any[] = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY sort_order ASC';

    const permissions = await query(sql, params);

    const permissionsWithRoleInfo = await Promise.all(
      permissions.map(async (perm: any) => {
        const rolePerms = await query(
          'SELECT role FROM role_permissions WHERE permission_id = ?',
          [perm.id]
        );
        return {
          ...perm,
          roles: rolePerms.map((rp: any) => rp.role)
        };
      })
    );

    res.json({ data: permissionsWithRoleInfo });
  } catch (error) {
    logger.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

router.get('/tree', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sql = 'SELECT * FROM permissions WHERE status = ? ORDER BY sort_order ASC';
    const permissions = await query(sql, ['active']);

    const buildTree = (parentId: number | null = null): any[] => {
      return permissions
        .filter((perm: any) => perm.parent_id === parentId)
        .map((perm: any) => ({
          ...perm,
          children: buildTree(perm.id)
        }));
    };

    const tree = buildTree();
    res.json({ data: tree });
  } catch (error) {
    logger.error('Get permission tree error:', error);
    res.status(500).json({ error: 'Failed to get permission tree' });
  }
});

router.get('/user', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.role;

    const sql = `
      SELECT p.* 
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role = ? AND p.status = ?
      ORDER BY p.sort_order ASC
    `;
    const permissions = await query(sql, [userRole, 'active']);

    res.json({ data: permissions });
  } catch (error) {
    logger.error('Get user permissions error:', error);
    res.status(500).json({ error: 'Failed to get user permissions' });
  }
});

router.get('/:id', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const permissions = await query('SELECT * FROM permissions WHERE id = ?', [id]);

    if (permissions.length === 0) {
      res.status(404).json({ error: 'Permission not found' });
      return;
    }

    const rolePerms = await query(
      'SELECT role FROM role_permissions WHERE permission_id = ?',
      [id]
    );

    res.json({
      ...permissions[0],
      roles: rolePerms.map((rp: any) => rp.role)
    });
  } catch (error) {
    logger.error('Get permission error:', error);
    res.status(500).json({ error: 'Failed to get permission' });
  }
});

router.post('/', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code, name, type, resource, action, parent_id, path, icon, sort_order = 0, description, status = 'active' } = req.body;

    if (!code || !name || !type || !resource) {
      res.status(400).json({ error: 'Code, name, type and resource are required' });
      return;
    }

    const existingPerm = await query('SELECT id FROM permissions WHERE code = ?', [code]);
    if (existingPerm.length > 0) {
      res.status(400).json({ error: 'Permission code already exists' });
      return;
    }

    const now = getBeijingTime();

    const result = await query(
      'INSERT INTO permissions (code, name, type, resource, action, parent_id, path, icon, sort_order, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [code, name, type, resource, action, parent_id || null, path, icon, sort_order, description, status, now, now]
    );

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'create', 'permission', result.lastID, getClientIp(req), req.get('user-agent'), 'success', now]
    );

    logger.info(`Permission created: ${code} by ${req.username}`);
    res.status(201).json({ message: 'Permission created successfully', permissionId: result.lastID });
  } catch (error) {
    logger.error('Create permission error:', error);
    res.status(500).json({ error: 'Failed to create permission' });
  }
});

router.put('/:id', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, resource, action, parent_id, path, icon, sort_order, description, status, roles } = req.body;

    const existingPerm = await query('SELECT id FROM permissions WHERE id = ?', [id]);
    if (existingPerm.length === 0) {
      res.status(404).json({ error: 'Permission not found' });
      return;
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type);
    }
    if (resource !== undefined) {
      updates.push('resource = ?');
      params.push(resource);
    }
    if (action !== undefined) {
      updates.push('action = ?');
      params.push(action);
    }
    if (parent_id !== undefined) {
      updates.push('parent_id = ?');
      params.push(parent_id || null);
    }
    if (path !== undefined) {
      updates.push('path = ?');
      params.push(path);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      params.push(icon);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(sort_order);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    updates.push('updated_at = ?');
    params.push(getBeijingTime());
    params.push(id);

    await query(
      `UPDATE permissions SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (roles !== undefined) {
      await query('DELETE FROM role_permissions WHERE permission_id = ?', [id]);

      if (roles.length > 0) {
        const now = getBeijingTime();
        for (const role of roles) {
          await query(
            'INSERT INTO role_permissions (role, permission_id, created_at) VALUES (?, ?, ?)',
            [role, id, now]
          );
        }
      }
    }

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'update', 'permission', id, getClientIp(req), req.get('user-agent'), 'success', getBeijingTime()]
    );

    logger.info(`Permission updated: ${id} by ${req.username}`);
    res.json({ message: 'Permission updated successfully' });
  } catch (error) {
    logger.error('Update permission error:', error);
    res.status(500).json({ error: 'Failed to update permission' });
  }
});

router.delete('/:id', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const childPerms = await query('SELECT id FROM permissions WHERE parent_id = ?', [id]);
    if (childPerms.length > 0) {
      res.status(400).json({ error: 'Cannot delete permission with child permissions' });
      return;
    }

    await query('DELETE FROM permissions WHERE id = ?', [id]);

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'delete', 'permission', id, getClientIp(req), req.get('user-agent'), 'success', getBeijingTime()]
    );

    logger.info(`Permission deleted: ${id} by ${req.username}`);
    res.json({ message: 'Permission deleted successfully' });
  } catch (error) {
    logger.error('Delete permission error:', error);
    res.status(500).json({ error: 'Failed to delete permission' });
  }
});

router.post('/assign-role', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, permission_ids } = req.body;

    if (!role || !permission_ids || !Array.isArray(permission_ids)) {
      res.status(400).json({ error: 'Role and permission_ids are required' });
      return;
    }

    await query('DELETE FROM role_permissions WHERE role = ?', [role]);

    const now = getBeijingTime();
    for (const permId of permission_ids) {
      await query(
        'INSERT INTO role_permissions (role, permission_id, created_at) VALUES (?, ?, ?)',
        [role, permId, now]
      );
    }

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, details, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'assign_permissions', 'role', JSON.stringify({ role, permission_ids }), getClientIp(req), req.get('user-agent'), 'success', now]
    );

    logger.info(`Permissions assigned to role: ${role} by ${req.username}`);
    res.json({ message: 'Permissions assigned successfully' });
  } catch (error) {
    logger.error('Assign permissions error:', error);
    res.status(500).json({ error: 'Failed to assign permissions' });
  }
});

router.get('/role/:role', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.params;

    const sql = `
      SELECT p.* 
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role = ? AND p.status = ?
      ORDER BY p.sort_order ASC
    `;
    const permissions = await query(sql, [role, 'active']);

    res.json({ data: permissions });
  } catch (error) {
    logger.error('Get role permissions error:', error);
    res.status(500).json({ error: 'Failed to get role permissions' });
  }
});

export default router;
