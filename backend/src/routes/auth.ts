import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, getBeijingTime, getTimezoneOffset } from '../config/database';
import { logger } from '../utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { loginRateLimiter } from '../middleware/rateLimiter';
import { getClientIp } from '../utils/ipHelper';

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, email, role = 'developer' } = req.body;

    if (!username || !password || !email) {
      res.status(400).json({ error: 'Username, password, and email are required' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await query(
      'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, email, role]
    );

    logger.info(`User registered: ${username}`);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Username or email already exists' });
    } else {
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

router.post('/login', loginRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const users = await query(
      'SELECT * FROM users WHERE username = ? AND status = ?',
      [username, 'active']
    );

    if (users.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, tokenPermissions: user.token_permissions ? JSON.parse(user.token_permissions) : null },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    const timezoneOffset = await getTimezoneOffset();

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, ip_address, user_agent, status, created_at, timezone_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [user.id, 'login', 'user', getClientIp(req), req.get('user-agent'), 'success', getBeijingTime(timezoneOffset), timezoneOffset]
    );

    logger.info(`User logged in: ${username}`);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const timezoneOffset = await getTimezoneOffset();

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, ip_address, user_agent, status, created_at, timezone_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'logout', 'user', getClientIp(req), req.get('user-agent'), 'success', getBeijingTime(timezoneOffset), timezoneOffset]
    );

    logger.info(`User logged out: ${req.username}`);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await query(
      'SELECT id, username, email, role, status, created_at FROM users WHERE id = ?',
      [req.userId]
    );

    if (users.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(users[0]);
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

export default router;
