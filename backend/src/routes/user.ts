import { Router, Response } from 'express';
import { query, getBeijingTime } from '../config/database';
import { logger } from '../utils/logger';
import { authenticateToken, AuthRequest, authorizeRoles } from '../middleware/auth';
import { getClientIp } from '../utils/ipHelper';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const router = Router();

router.use(authenticateToken);

function generateApiToken(): string {
  return 'api_' + crypto.randomBytes(32).toString('hex');
}

router.get('/', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, role, status, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let sql = 'SELECT id, username, email, role, status, created_at, api_token, token_expires_at, token_permissions FROM users WHERE 1=1';
    const params: any[] = [];

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (username LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const users = await query(sql, params);

    const countSql = sql.split('ORDER BY')[0].replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countParams = params.slice(0, -2);
    const [{ total }] = await query(countSql, countParams);

    res.json({
      data: users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        totalPages: Math.ceil(Number(total) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/:id', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const users = await query(
      'SELECT id, username, email, role, status, created_at, api_token, token_expires_at, token_permissions FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(users[0]);
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.put('/:id', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, role, status } = req.body;

    const existingUser = await query('SELECT id FROM users WHERE id = ?', [id]);
    if (existingUser.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(id);

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'update', 'user', id, getClientIp(req), req.get('user-agent'), 'success', getBeijingTime()]
    );

    logger.info(`User updated: ${id} by ${req.username}`);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.put('/:id/password', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { old_password, new_password } = req.body;

    if (!new_password) {
      res.status(400).json({ error: 'New password is required' });
      return;
    }

    if (new_password.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }

    if (req.role !== 'admin' && id !== req.userId?.toString()) {
      res.status(403).json({ error: 'You can only change your own password' });
      return;
    }

    const users = await query('SELECT id, password FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (req.role !== 'admin') {
      if (!old_password) {
        res.status(400).json({ error: 'Old password is required' });
        return;
      }

      const user = users[0];
      const isValidPassword = await bcrypt.compare(old_password, user.password);

      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid old password' });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await query(
      'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
      [hashedPassword, getBeijingTime(), id]
    );

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'update', 'user_password', id, getClientIp(req), req.get('user-agent'), 'success', getBeijingTime()]
    );

    logger.info(`Password changed for user: ${id} by ${req.username}`);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.delete('/:id', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (id === req.userId?.toString()) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }

    await query('DELETE FROM users WHERE id = ?', [id]);

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'delete', 'user', id, getClientIp(req), req.get('user-agent'), 'success', getBeijingTime()]
    );

    logger.info(`User deleted: ${id} by ${req.username}`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.post('/', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, password, email, role = 'developer', status = 'active' } = req.body;

    if (!username || !password || !email) {
      res.status(400).json({ error: 'Username, password and email are required' });
      return;
    }

    const existingUser = await query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser.length > 0) {
      res.status(400).json({ error: 'Username or email already exists' });
      return;
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const now = getBeijingTime();

    const result = await query(
      'INSERT INTO users (username, password, email, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, email, role, status, now, now]
    );

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'create', 'user', result.lastID, getClientIp(req), req.get('user-agent'), 'success', now]
    );

    logger.info(`User created: ${username} by ${req.username}`);
    res.status(201).json({ message: 'User created successfully', userId: result.lastID });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.post('/:id/token', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { expires_in_days = 30, permissions = 'all' } = req.body;

    if (req.role !== 'admin' && id !== req.userId?.toString()) {
      res.status(403).json({ error: 'You can only manage your own token' });
      return;
    }

    const users = await query('SELECT id FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const apiToken = generateApiToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(expires_in_days));

    await query(
      'UPDATE users SET api_token = ?, token_expires_at = ?, token_permissions = ?, updated_at = ? WHERE id = ?',
      [apiToken, expiresAt.toISOString(), JSON.stringify(permissions), getBeijingTime(), id]
    );

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'update', 'user_token', id, getClientIp(req), req.get('user-agent'), 'success', getBeijingTime()]
    );

    logger.info(`Token generated for user: ${id} by ${req.username}`);
    res.json({
      message: 'Token generated successfully',
      api_token: apiToken,
      token_expires_at: expiresAt.toISOString(),
      token_permissions: permissions
    });
  } catch (error) {
    logger.error('Generate token error:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

router.get('/:id/token', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (req.role !== 'admin' && id !== req.userId?.toString()) {
      res.status(403).json({ error: 'You can only view your own token' });
      return;
    }

    const users = await query(
      'SELECT id, api_token, token_expires_at, token_permissions FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = users[0];
    res.json({
      api_token: user.api_token,
      token_expires_at: user.token_expires_at,
      token_permissions: user.token_permissions ? JSON.parse(user.token_permissions) : null,
      is_expired: user.token_expires_at ? new Date(user.token_expires_at) < new Date() : false
    });
  } catch (error) {
    logger.error('Get token error:', error);
    res.status(500).json({ error: 'Failed to get token' });
  }
});

router.delete('/:id/token', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (req.role !== 'admin' && id !== req.userId?.toString()) {
      res.status(403).json({ error: 'You can only manage your own token' });
      return;
    }

    await query(
      'UPDATE users SET api_token = NULL, token_expires_at = NULL, token_permissions = NULL, updated_at = ? WHERE id = ?',
      [getBeijingTime(), id]
    );

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'delete', 'user_token', id, getClientIp(req), req.get('user-agent'), 'success', getBeijingTime()]
    );

    logger.info(`Token deleted for user: ${id} by ${req.username}`);
    res.json({ message: 'Token deleted successfully' });
  } catch (error) {
    logger.error('Delete token error:', error);
    res.status(500).json({ error: 'Failed to delete token' });
  }
});

export default router;
