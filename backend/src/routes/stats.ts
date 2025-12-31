import { Router, Response } from 'express';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { authenticateToken, AuthRequest, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/dashboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalApis] = await query('SELECT COUNT(*) as count FROM apis');
    const [totalDatasources] = await query('SELECT COUNT(*) as count FROM datasources');
    const [totalUsers] = await query('SELECT COUNT(*) as count FROM users');
    const [totalCalls] = await query('SELECT SUM(call_count) as total FROM api_call_stats');

    const [todayCalls] = await query(`
      SELECT COALESCE(SUM(call_count), 0) as total
      FROM api_call_stats
      WHERE date = DATE('now')
    `);

    const topApis = await query(`
      SELECT a.name, SUM(s.call_count) as total_calls
      FROM apis a
      LEFT JOIN api_call_stats s ON a.id = s.api_id
      GROUP BY a.id, a.name
      ORDER BY total_calls DESC
      LIMIT 10
    `);

    const recentLogs = await query(`
      SELECT l.*, u.username
      FROM operation_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 10
    `);

    res.json({
      overview: {
        totalApis: totalApis.count,
        totalDatasources: totalDatasources.count,
        totalUsers: totalUsers.count,
        totalCalls: totalCalls.total || 0,
        todayCalls: todayCalls.total
      },
      topApis,
      recentLogs
    });
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

router.get('/apis', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { api_id, start_date, end_date } = req.query;

    let sql = `
      SELECT s.*, a.name as api_name
      FROM api_call_stats s
      LEFT JOIN apis a ON s.api_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (api_id) {
      sql += ' AND s.api_id = ?';
      params.push(api_id);
    }

    if (start_date) {
      sql += ' AND s.date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND s.date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY s.date DESC';

    const stats = await query(sql, params);

    res.json(stats);
  } catch (error) {
    logger.error('Get API stats error:', error);
    res.status(500).json({ error: 'Failed to get API stats' });
  }
});

router.get('/trends', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { days = 30 } = req.query;

    const trends = await query(`
      SELECT
        date,
        SUM(call_count) as total_calls,
        SUM(success_count) as success_count,
        SUM(failure_count) as failure_count,
        AVG(avg_response_time) as avg_response_time
      FROM api_call_stats
      WHERE date >= DATE('now', '-' || ? || ' days')
      GROUP BY date
      ORDER BY date ASC
    `, [Number(days)]);

    res.json(trends);
  } catch (error) {
    logger.error('Get trends error:', error);
    res.status(500).json({ error: 'Failed to get trends' });
  }
});

export default router;
