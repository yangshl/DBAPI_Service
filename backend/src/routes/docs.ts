import { Router, Response } from 'express';
import { query, getBeijingTime } from '../config/database';
import { logger } from '../utils/logger';
import { optionalApiTokenAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(optionalApiTokenAuth);

router.get('/published', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category } = req.query;

    let sql = `
      SELECT a.*, d.name as datasource_name
      FROM apis a
      LEFT JOIN datasources d ON a.datasource_id = d.id
      WHERE a.status = 'published'
    `;
    const params: any[] = [];

    if (category) {
      sql += ' AND a.category = ?';
      params.push(category);
    }

    sql += ' ORDER BY a.category, a.name';

    const apis = await query(sql, params);

    const categories: any = {};
    for (const api of apis) {
      if (!categories[api.category]) {
        categories[api.category] = [];
      }
      categories[api.category].push(api);
    }

    res.json({
      categories,
      apis
    });
  } catch (error) {
    logger.error('Get published APIs error:', error);
    res.status(500).json({ error: 'Failed to get published APIs' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const apis = await query(
      `
      SELECT a.*, d.name as datasource_name, d.type as datasource_type
      FROM apis a
      LEFT JOIN datasources d ON a.datasource_id = d.id
      WHERE a.id = ? AND a.status = 'published'
      `,
      [id]
    );

    if (apis.length === 0) {
      res.status(404).json({ error: 'API not found' });
      return;
    }

    const parameters = await query(
      'SELECT * FROM api_parameters WHERE api_id = ? ORDER BY id',
      [id]
    );

    res.json({ ...apis[0], parameters });
  } catch (error) {
    logger.error('Get API detail error:', error);
    res.status(500).json({ error: 'Failed to get API detail' });
  }
});

export default router;
