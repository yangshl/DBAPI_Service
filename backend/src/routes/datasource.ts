import { Router, Response } from 'express';
import { query, getBeijingTime, getTimezoneOffset } from '../config/database';
import { logger } from '../utils/logger';
import { authenticateToken, AuthRequest, authorizeRoles } from '../middleware/auth';
import { databasePool } from '../services/databasePool';
import { getClientIp } from '../utils/ipHelper';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const datasources = await query(
      'SELECT id, name, type, host, port, database_name, status, created_at FROM datasources ORDER BY created_at DESC'
    );

    res.json(datasources);
  } catch (error) {
    logger.error('Get datasources error:', error);
    res.status(500).json({ error: 'Failed to get datasources' });
  }
});

router.post('/test', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, host, port, database_name, username, password } = req.body;

    if (!type || !host || !port || !database_name || !username || !password) {
      res.status(400).json({ success: false, error: 'All connection parameters are required' });
      return;
    }

    const result = await databasePool.testConnection({
      type,
      host,
      port,
      user: username,
      password,
      database: database_name
    });

    res.json({ success: result });
  } catch (error) {
    logger.error('Test connection error:', error);
    res.status(500).json({ success: false, error: 'Connection test failed' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const datasources = await query(
      'SELECT * FROM datasources WHERE id = ?',
      [id]
    );

    if (datasources.length === 0) {
      res.status(404).json({ error: 'Datasource not found' });
      return;
    }

    const ds = datasources[0];
    delete ds.password;

    res.json(ds);
  } catch (error) {
    logger.error('Get datasource error:', error);
    res.status(500).json({ error: 'Failed to get datasource' });
  }
});

router.post('/', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, type, host, port, database_name, username, password, status } = req.body;

    if (!name || !type || !host || !port || !database_name || !username || !password) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const testResult = await databasePool.testConnection({
      type,
      host,
      port,
      user: username,
      password,
      database: database_name
    });

    if (!testResult) {
      res.status(400).json({ error: 'Connection test failed' });
      return;
    }

    const timezoneOffset = await getTimezoneOffset();

    const result = await query(
      'INSERT INTO datasources (name, type, host, port, database_name, username, password, status, created_by, timezone_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, type, host, port, database_name, username, password, status || 'active', req.userId, timezoneOffset]
    );

    const datasourceId = result.insertId;

    await databasePool.createPool({
      type,
      host,
      port,
      user: username,
      password,
      database: database_name
    }, `ds_${datasourceId}`);

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at, timezone_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'create', 'datasource', datasourceId, getClientIp(req), req.get('user-agent'), 'success', getBeijingTime(), timezoneOffset]
    );

    logger.info(`Datasource created: ${name} by ${req.username}`);
    res.status(201).json({ message: 'Datasource created successfully', id: datasourceId });
  } catch (error) {
    logger.error('Create datasource error:', error);
    res.status(500).json({ error: 'Failed to create datasource' });
  }
});

router.put('/:id', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, host, port, database_name, username, password, status } = req.body;

    const existingDatasources = await query(
      'SELECT * FROM datasources WHERE id = ?',
      [id]
    );

    if (existingDatasources.length === 0) {
      res.status(404).json({ error: 'Datasource not found' });
      return;
    }

    const existing = existingDatasources[0];

    const updateName = name ?? existing.name;
    const updateType = type ?? existing.type;
    const updateHost = host ?? existing.host;
    const updatePort = port ?? existing.port;
    const updateDatabaseName = database_name ?? existing.database_name;
    const updateUsername = username ?? existing.username;
    const updatePassword = password ?? existing.password;
    const updateStatus = status ?? existing.status;

    const timezoneOffset = await getTimezoneOffset();

    await query(
      'UPDATE datasources SET name = ?, type = ?, host = ?, port = ?, database_name = ?, username = ?, password = ?, status = ?, timezone_offset = ? WHERE id = ?',
      [updateName, updateType, updateHost, updatePort, updateDatabaseName, updateUsername, updatePassword, updateStatus, timezoneOffset, id]
    );

    if (type || host || port || username || password || database_name) {
      await databasePool.closePool(`ds_${id}`, existing.type);

      await databasePool.createPool({
        type: updateType,
        host: updateHost,
        port: updatePort,
        user: updateUsername,
        password: updatePassword,
        database: updateDatabaseName
      }, `ds_${id}`);
    }

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at, timezone_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'update', 'datasource', id, getClientIp(req), req.get('user-agent'), 'success', getBeijingTime(timezoneOffset), timezoneOffset]
    );

    logger.info(`Datasource updated: ${id} by ${req.username}`);
    res.json({ message: 'Datasource updated successfully' });
  } catch (error) {
    logger.error('Update datasource error:', error);
    res.status(500).json({ error: 'Failed to update datasource' });
  }
});

router.delete('/:id', authorizeRoles('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const datasources = await query(
      'SELECT * FROM datasources WHERE id = ?',
      [id]
    );

    if (datasources.length > 0) {
      const ds = datasources[0];
      await databasePool.closePool(`ds_${id}`, ds.type);
    }

    await query('DELETE FROM datasources WHERE id = ?', [id]);

    await query(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'delete', 'datasource', id, getClientIp(req), req.get('user-agent'), 'success', getBeijingTime()]
    );

    logger.info(`Datasource deleted: ${id} by ${req.username}`);
    res.json({ message: 'Datasource deleted successfully' });
  } catch (error) {
    logger.error('Delete datasource error:', error);
    res.status(500).json({ error: 'Failed to delete datasource' });
  }
});

router.post('/:id/test', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const datasources = await query(
      'SELECT * FROM datasources WHERE id = ?',
      [id]
    );

    if (datasources.length === 0) {
      res.status(404).json({ error: 'Datasource not found' });
      return;
    }

    const ds = datasources[0];

    const result = await databasePool.testConnection({
      type: ds.type,
      host: ds.host,
      port: ds.port,
      user: ds.username,
      password: ds.password,
      database: ds.database_name
    });

    res.json({ success: result });
  } catch (error) {
    logger.error('Test datasource error:', error);
    res.status(500).json({ success: false, error: 'Connection test failed' });
  }
});

export default router;
