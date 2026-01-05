import { Router, Response } from 'express';
import { query, getBeijingTime, getTimezoneOffset } from '../config/database';
import { logger } from '../utils/logger';
import { authenticateToken, AuthRequest, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 50, action, resource_type, status, start_date, end_date } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let sql = `
      SELECT l.*, u.username
      FROM operation_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (req.role !== 'admin') {
      sql += ' AND l.user_id = ?';
      params.push(req.userId);
    }

    if (action) {
      sql += ' AND l.action = ?';
      params.push(action);
    }

    if (resource_type) {
      sql += ' AND l.resource_type = ?';
      params.push(resource_type);
    }

    if (status) {
      sql += ' AND l.status = ?';
      params.push(status);
    }

    if (start_date) {
      sql += ' AND l.created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND l.created_at <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const logs = await query(sql, params);

    let countSql = `
      SELECT COUNT(*) as total
      FROM operation_logs l
      WHERE 1=1
    `;
    const countParams: any[] = [];

    if (req.role !== 'admin') {
      countSql += ' AND l.user_id = ?';
      countParams.push(req.userId);
    }

    if (action) {
      countSql += ' AND l.action = ?';
      countParams.push(action);
    }

    if (resource_type) {
      countSql += ' AND l.resource_type = ?';
      countParams.push(resource_type);
    }

    if (status) {
      countSql += ' AND l.status = ?';
      countParams.push(status);
    }

    if (start_date) {
      countSql += ' AND l.created_at >= ?';
      countParams.push(start_date);
    }

    if (end_date) {
      countSql += ' AND l.created_at <= ?';
      countParams.push(end_date);
    }

    const [{ total }] = await query(countSql, countParams);

    res.json({
      data: logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        totalPages: Math.ceil(Number(total) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

router.get('/stats', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const timezoneOffset = await getTimezoneOffset();
    const thirtyDaysAgoStr = getBeijingTime(timezoneOffset).replace(/\s[\d:]+$/, ' 00:00:00');
    
    const stats = await query(`
      SELECT
        action,
        resource_type,
        status,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM operation_logs
      WHERE created_at >= ?
      GROUP BY action, resource_type, status, DATE(created_at)
      ORDER BY date DESC
    `, [thirtyDaysAgoStr]);

    res.json(stats);
  } catch (error) {
    logger.error('Get log stats error:', error);
    res.status(500).json({ error: 'Failed to get log stats' });
  }
});

router.get('/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, resource_type, status, start_date, end_date } = req.query;

    let sql = `
      SELECT l.id, l.action, l.resource_type, u.username, l.ip_address, l.status, l.created_at
      FROM operation_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (req.role !== 'admin') {
      sql += ' AND l.user_id = ?';
      params.push(req.userId);
    }

    if (action) {
      sql += ' AND l.action = ?';
      params.push(action);
    }

    if (resource_type) {
      sql += ' AND l.resource_type = ?';
      params.push(resource_type);
    }

    if (status) {
      sql += ' AND l.status = ?';
      params.push(status);
    }

    if (start_date) {
      sql += ' AND l.created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND l.created_at <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY l.created_at DESC';

    const logs = await query(sql, params);

    const csvHeader = 'ID,操作,资源类型,用户,IP地址,状态,时间\n';
    const csvRows = logs.map((log: any) => {
      const statusText = log.status === 'success' ? '成功' : '失败';
      return `${log.id},${log.action},${log.resource_type},${log.username},${log.ip_address},${statusText},${log.created_at}`;
    }).join('\n');

    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=logs.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    logger.error('Export logs error:', error);
    res.status(500).json({ error: 'Failed to export logs' });
  }
});

export default router;
