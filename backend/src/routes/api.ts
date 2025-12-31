import { Router, Response, NextFunction } from 'express';
import { query, getBeijingTime } from '../config/database';
import { logger } from '../utils/logger';
import { authenticateApiToken, AuthRequest, authorizeRoles } from '../middleware/auth';
import { checkIpWhitelist } from '../middleware/ipWhitelist';
import { sqlParameterExtractor } from '../utils/sqlParameterExtractor';
import { getClientIp } from '../utils/ipHelper';

const router = Router();

router.use(authenticateApiToken);

router.use(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token && token.startsWith('api_')) {
    await checkIpWhitelist(req, res, next);
  } else {
    next();
  }
});

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status, search, category } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let sql = `
      SELECT a.*, d.name as datasource_name, u.username as created_by_name
      FROM apis a
      LEFT JOIN datasources d ON a.datasource_id = d.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    if (category) {
      sql += ' AND a.category = ?';
      params.push(category);
    }

    if (search) {
      sql += ' AND (a.name LIKE ? OR a.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const apis = await query(sql, params);

    let countSql = `
      SELECT COUNT(*) as total
      FROM apis a
      LEFT JOIN datasources d ON a.datasource_id = d.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE 1=1
    `;
    const countParams: any[] = [];

    if (status) {
      countSql += ' AND a.status = ?';
      countParams.push(status);
    }

    if (category) {
      countSql += ' AND a.category = ?';
      countParams.push(category);
    }

    if (search) {
      countSql += ' AND (a.name LIKE ? OR a.description LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    logger.info('Count SQL:', countSql);
    logger.info('Count params:', JSON.stringify(countParams));
    const countResult = await query(countSql, countParams);
    logger.info('Count result:', JSON.stringify(countResult));
    const total = countResult && countResult.length > 0 ? (countResult[0]?.total || 0) : 0;
    logger.info('Total count:', total);

    res.json({
      data: apis,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        totalPages: Math.ceil(Number(total) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Get APIs error:', error);
    res.status(500).json({ error: 'Failed to get APIs' });
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
      WHERE a.id = ?
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
    logger.error('Get API error:', error);
    res.status(500).json({ error: 'Failed to get API' });
  }
});

router.post('/', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, path, method, description, datasource_id, sql_template, status, require_auth = 1, category = 'default', parameters = [] } = req.body;

    if (!name || !path || !datasource_id || !sql_template) {
      res.status(400).json({ error: 'Name, path, datasource_id, and sql_template are required' });
      return;
    }

    const now = getBeijingTime();

    const result = await query(
      'INSERT INTO apis (name, path, method, description, datasource_id, sql_template, status, require_auth, category, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, path, method || 'GET', description, datasource_id, sql_template, status || 'draft', require_auth, category, req.userId, now, now]
    );

    const apiId = result.insertId;

    if (parameters.length > 0) {
      for (const param of parameters) {
        await query(
          'INSERT INTO api_parameters (api_id, param_name, param_type, data_type, required, default_value, validation_rule, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [apiId, param.param_name, param.param_type, param.data_type, param.required, param.default_value, param.validation_rule, param.description, now]
        );
      }
    }

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'create', 'api', apiId, getClientIp(req), req.get('user-agent'), 'success', now]
    );

    logger.info(`API created: ${name} by ${req.username}`);
    res.status(201).json({ message: 'API created successfully', id: apiId });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'API path already exists' });
    } else {
      logger.error('Create API error:', error);
      res.status(500).json({ error: 'Failed to create API' });
    }
  }
});

router.put('/:id', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, path, method, description, datasource_id, sql_template, status, require_auth, category, parameters = [] } = req.body;

    const now = getBeijingTime();

    await query(
      'UPDATE apis SET name = ?, path = ?, method = ?, description = ?, datasource_id = ?, sql_template = ?, status = ?, require_auth = ?, category = ?, updated_at = ? WHERE id = ?',
      [name, path, method, description, datasource_id, sql_template, status, require_auth, category, now, id]
    );

    let parametersToSave = parameters;

    if (parametersToSave.length === 0 && sql_template) {
      const existingParameters = await query(
        'SELECT * FROM api_parameters WHERE api_id = ? ORDER BY id',
        [id]
      );
      const extractedParameters = sqlParameterExtractor.extractParametersWithDefaults(
        sql_template,
        existingParameters
      );
      parametersToSave = extractedParameters;
    }

    await query('DELETE FROM api_parameters WHERE api_id = ?', [id]);

    if (parametersToSave.length > 0) {
      for (const param of parametersToSave) {
        await query(
          'INSERT INTO api_parameters (api_id, param_name, param_type, data_type, required, default_value, validation_rule, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, param.param_name, param.param_type, param.data_type, param.required, param.default_value, param.validation_rule, param.description, now]
        );
      }
    }

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'update', 'api', id, getClientIp(req), req.get('user-agent'), 'success', now]
    );

    logger.info(`API updated: ${id} by ${req.username}`);
    res.json({ message: 'API updated successfully' });
  } catch (error) {
    logger.error('Update API error:', error);
    res.status(500).json({ error: 'Failed to update API' });
  }
});

router.delete('/:id', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const now = getBeijingTime();

    await query('DELETE FROM apis WHERE id = ?', [id]);

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'delete', 'api', id, getClientIp(req), req.get('user-agent'), 'success', now]
    );

    logger.info(`API deleted: ${id} by ${req.username}`);
    res.json({ message: 'API deleted successfully' });
  } catch (error) {
    logger.error('Delete API error:', error);
    res.status(500).json({ error: 'Failed to delete API' });
  }
});

router.post('/:id/test', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { params = {} } = req.body;

    const apis = await query(
      'SELECT a.*, d.* FROM apis a LEFT JOIN datasources d ON a.datasource_id = d.id WHERE a.id = ?',
      [id]
    );

    if (apis.length === 0) {
      res.status(404).json({ error: 'API not found' });
      return;
    }

    const api = apis[0];
    const { databasePool } = await import('../services/databasePool');

    let sql = api.sql_template;
    const queryParams: any[] = [];

    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{{${key}}}`;
      if (sql.includes(placeholder)) {
        sql = sql.replace(new RegExp(placeholder, 'g'), '?');
        queryParams.push(value);
      }
    }

    const trimmedSql = sql.trim().toUpperCase();
    if (trimmedSql.startsWith('SELECT')) {
      if (api.type === 'mysql' || api.type === 'postgresql') {
        if (!trimmedSql.includes(' LIMIT ') && !trimmedSql.endsWith(' LIMIT')) {
          const lastSemicolon = sql.lastIndexOf(';');
          if (lastSemicolon !== -1) {
            sql = sql.substring(0, lastSemicolon) + ' LIMIT 1000' + sql.substring(lastSemicolon);
          } else {
            sql = sql + ' LIMIT 1000';
          }
        }
      } else if (api.type === 'mssql') {
        if (!trimmedSql.includes(' TOP ')) {
          sql = sql.replace(/^SELECT\s+/i, 'SELECT TOP 1000 ');
        }
      } else if (api.type === 'oracle') {
        if (!trimmedSql.includes(' ROWNUM ') && !trimmedSql.includes(' FETCH FIRST ')) {
          const lastSemicolon = sql.lastIndexOf(';');
          const limitClause = ' FETCH FIRST 1000 ROWS ONLY';
          if (lastSemicolon !== -1) {
            sql = sql.substring(0, lastSemicolon) + limitClause + sql.substring(lastSemicolon);
          } else {
            sql = sql + limitClause;
          }
        }
      }
    }

    const startTime = Date.now();
    const results = await databasePool.executeQuery(`ds_${api.datasource_id}`, sql, queryParams, api.type);
    const executionTime = Date.now() - startTime;

    res.json({
      success: true,
      data: results,
      executionTime: `${executionTime}ms`,
      rowCount: Array.isArray(results) ? results.length : 0
    });
  } catch (error: any) {
    logger.error('Test API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute SQL'
    });
  }
});

router.get('/:id/access-logs', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, status, start_date, end_date } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let sql = `
      SELECT al.*, a.name as api_name, a.path as api_path, u.username as user_name
      FROM api_access_logs al
      LEFT JOIN apis a ON al.api_id = a.id
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.api_id = ?
    `;
    const params: any[] = [id];

    if (status) {
      sql += ' AND al.status = ?';
      params.push(status);
    }

    if (start_date) {
      sql += ' AND al.created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND al.created_at <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const logs = await query(sql, params);

    const countSql = sql.split('ORDER BY')[0].replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countParams = params.slice(0, -2);
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
    logger.error('Get API access logs error:', error);
    res.status(500).json({ error: 'Failed to get API access logs' });
  }
});

router.post('/extract-parameters', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sql_template, api_id } = req.body;

    if (!sql_template) {
      res.status(400).json({ error: 'sql_template is required' });
      return;
    }

    let existingParameters: any[] = [];

    if (api_id) {
      const parameters = await query(
        'SELECT * FROM api_parameters WHERE api_id = ? ORDER BY id',
        [api_id]
      );
      existingParameters = parameters;
    }

    const extractedParameters = sqlParameterExtractor.extractParametersWithDefaults(
      sql_template,
      existingParameters
    );

    res.json({
      success: true,
      parameters: extractedParameters
    });
  } catch (error) {
    logger.error('Extract parameters error:', error);
    res.status(500).json({ error: 'Failed to extract parameters' });
  }
});

export default router;
