import { Router, Request, Response } from 'express';
import { query, run, get, getBeijingTime } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

router.get('/categories', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await query(
      'SELECT * FROM api_categories ORDER BY sort_order ASC, id ASC'
    );
    res.json(categories);
  } catch (error) {
    logger.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

router.get('/categories/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const category = await get(
      'SELECT * FROM api_categories WHERE id = ?',
      [id]
    );
    
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    res.json(category);
  } catch (error) {
    logger.error('Get category error:', error);
    res.status(500).json({ error: 'Failed to get category' });
  }
});

router.post('/categories', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, description, sort_order, status } = req.body;
    const now = getBeijingTime();
    
    if (!name || !code) {
      res.status(400).json({ error: 'Name and code are required' });
      return;
    }
    
    const existing = await get(
      'SELECT id FROM api_categories WHERE code = ?',
      [code]
    );
    
    if (existing) {
      res.status(400).json({ error: 'Category code already exists' });
      return;
    }
    
    const result = await run(
      'INSERT INTO api_categories (name, code, description, sort_order, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, code, description, sort_order || 0, status || 'active', req.userId, now, now]
    );
    
    const category = await get(
      'SELECT * FROM api_categories WHERE id = ?',
      [result.lastID]
    );
    
    res.status(201).json(category);
  } catch (error) {
    logger.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, description, sort_order, status } = req.body;
    const now = getBeijingTime();
    
    const existing = await get(
      'SELECT * FROM api_categories WHERE id = ?',
      [id]
    );
    
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    if (code && code !== existing.code) {
      const codeExists = await get(
        'SELECT id FROM api_categories WHERE code = ? AND id != ?',
        [code, id]
      );
      
      if (codeExists) {
        res.status(400).json({ error: 'Category code already exists' });
        return;
      }
    }
    
    await run(
      'UPDATE api_categories SET name = COALESCE(?, name), code = COALESCE(?, code), description = COALESCE(?, description), sort_order = COALESCE(?, sort_order), status = COALESCE(?, status), updated_at = ? WHERE id = ?',
      [name, code, description, sort_order, status, now, id]
    );
    
    const category = await get(
      'SELECT * FROM api_categories WHERE id = ?',
      [id]
    );
    
    res.json(category);
  } catch (error) {
    logger.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const existing = await get(
      'SELECT * FROM api_categories WHERE id = ?',
      [id]
    );
    
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    const apiCount = await get(
      'SELECT COUNT(*) as count FROM apis WHERE category = ?',
      [existing.code]
    );
    
    if (apiCount.count > 0) {
      res.status(400).json({ error: 'Cannot delete category that is in use by APIs' });
      return;
    }
    
    await run('DELETE FROM api_categories WHERE id = ?', [id]);
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    logger.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

router.get('/whitelist', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whitelist = await query(
      'SELECT * FROM ip_whitelist ORDER BY id DESC'
    );
    res.json(whitelist);
  } catch (error) {
    logger.error('Get whitelist error:', error);
    res.status(500).json({ error: 'Failed to get whitelist' });
  }
});

router.get('/whitelist/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const item = await get(
      'SELECT * FROM ip_whitelist WHERE id = ?',
      [id]
    );
    
    if (!item) {
      res.status(404).json({ error: 'Whitelist item not found' });
      return;
    }
    
    res.json(item);
  } catch (error) {
    logger.error('Get whitelist item error:', error);
    res.status(500).json({ error: 'Failed to get whitelist item' });
  }
});

router.post('/whitelist', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ip_address, description, enabled } = req.body;
    const now = getBeijingTime();
    
    if (!ip_address) {
      res.status(400).json({ error: 'IP address is required' });
      return;
    }
    
    const existing = await get(
      'SELECT id FROM ip_whitelist WHERE ip_address = ?',
      [ip_address]
    );
    
    if (existing) {
      res.status(400).json({ error: 'IP address already exists in whitelist' });
      return;
    }
    
    const result = await run(
      'INSERT INTO ip_whitelist (ip_address, description, enabled, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [ip_address, description, enabled !== undefined ? enabled : 1, req.userId, now, now]
    );
    
    const item = await get(
      'SELECT * FROM ip_whitelist WHERE id = ?',
      [result.lastID]
    );
    
    res.status(201).json(item);
  } catch (error) {
    logger.error('Create whitelist item error:', error);
    res.status(500).json({ error: 'Failed to create whitelist item' });
  }
});

router.put('/whitelist/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { ip_address, description, enabled } = req.body;
    const now = getBeijingTime();
    
    const existing = await get(
      'SELECT * FROM ip_whitelist WHERE id = ?',
      [id]
    );
    
    if (!existing) {
      res.status(404).json({ error: 'Whitelist item not found' });
      return;
    }
    
    if (ip_address && ip_address !== existing.ip_address) {
      const ipExists = await get(
        'SELECT id FROM ip_whitelist WHERE ip_address = ? AND id != ?',
        [ip_address, id]
      );
      
      if (ipExists) {
        res.status(400).json({ error: 'IP address already exists in whitelist' });
        return;
      }
    }
    
    await run(
      'UPDATE ip_whitelist SET ip_address = COALESCE(?, ip_address), description = COALESCE(?, description), enabled = COALESCE(?, enabled), updated_at = ? WHERE id = ?',
      [ip_address, description, enabled, now, id]
    );
    
    const item = await get(
      'SELECT * FROM ip_whitelist WHERE id = ?',
      [id]
    );
    
    res.json(item);
  } catch (error) {
    logger.error('Update whitelist item error:', error);
    res.status(500).json({ error: 'Failed to update whitelist item' });
  }
});

router.delete('/whitelist/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const existing = await get(
      'SELECT * FROM ip_whitelist WHERE id = ?',
      [id]
    );
    
    if (!existing) {
      res.status(404).json({ error: 'Whitelist item not found' });
      return;
    }
    
    await run('DELETE FROM ip_whitelist WHERE id = ?', [id]);
    
    res.json({ message: 'Whitelist item deleted successfully' });
  } catch (error) {
    logger.error('Delete whitelist item error:', error);
    res.status(500).json({ error: 'Failed to delete whitelist item' });
  }
});

router.get('/settings', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await query(
      'SELECT * FROM system_settings WHERE 1=1'
    );
    
    const settingsMap: Record<string, any> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }
    
    res.json(settingsMap);
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

router.put('/settings/:key', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const now = getBeijingTime();
    
    if (value === undefined) {
      res.status(400).json({ error: 'Value is required' });
      return;
    }
    
    const existing = await get(
      'SELECT * FROM system_settings WHERE key = ?',
      [key]
    );
    
    if (existing) {
      await run(
        'UPDATE system_settings SET value = ?, updated_at = ? WHERE key = ?',
        [value, now, key]
      );
    } else {
      await run(
        'INSERT INTO system_settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [key, value, now, now]
      );
    }
    
    const setting = await get(
      'SELECT * FROM system_settings WHERE key = ?',
      [key]
    );
    
    res.json(setting);
  } catch (error) {
    logger.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;
