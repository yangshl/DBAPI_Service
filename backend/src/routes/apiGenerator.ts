import { Router, Response } from 'express';
import { query, run, getBeijingTime, getTimezoneOffset } from '../config/database';
import { logger } from '../utils/logger';
import { authenticateApiToken, AuthRequest, authorizeRoles } from '../middleware/auth';
import { schemaIntrospector } from '../services/schemaIntrospector';
import { apiGenerator } from '../services/apiGenerator';
import { getClientIp } from '../utils/ipHelper';

const router = Router();

router.use(authenticateApiToken);

router.get('/datasources/:datasourceId/tables', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { datasourceId } = req.params;

    const datasources = await query(
      'SELECT * FROM datasources WHERE id = ?',
      [datasourceId]
    );

    if (datasources.length === 0) {
      res.status(404).json({ error: 'Datasource not found' });
      return;
    }

    const ds = datasources[0];

    const tables = await schemaIntrospector.getTables(parseInt(datasourceId), ds.type);

    res.json({
      datasourceId,
      datasourceName: ds.name,
      type: ds.type,
      tables
    });
  } catch (error: any) {
    logger.error('Get tables error:', error);
    res.status(500).json({ error: error.message || 'Failed to get tables' });
  }
});

router.get('/datasources/:datasourceId/tables/:tableName/schema', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { datasourceId, tableName } = req.params;

    const datasources = await query(
      'SELECT * FROM datasources WHERE id = ?',
      [datasourceId]
    );

    if (datasources.length === 0) {
      res.status(404).json({ error: 'Datasource not found' });
      return;
    }

    const ds = datasources[0];

    const schema = await schemaIntrospector.getTableSchema(parseInt(datasourceId), ds.type, tableName);

    res.json(schema);
  } catch (error: any) {
    logger.error('Get table schema error:', error);
    res.status(500).json({ error: error.message || 'Failed to get table schema' });
  }
});

router.post('/generate', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { datasourceId, tableName, apiName, apiPath, category = 'default', status = 'draft', selectedAPIs = [] } = req.body;

    if (!datasourceId || !tableName) {
      res.status(400).json({ error: 'datasourceId and tableName are required' });
      return;
    }

    const datasources = await query(
      'SELECT * FROM datasources WHERE id = ?',
      [datasourceId]
    );

    if (datasources.length === 0) {
      res.status(404).json({ error: 'Datasource not found' });
      return;
    }

    const ds = datasources[0];

    const schema = await schemaIntrospector.getTableSchema(datasourceId, ds.type, tableName);

    const generatedAPIs = apiGenerator.generateFullCRUDAPIs(schema, apiName, apiPath);
    logger.info(`Generated ${generatedAPIs.length} APIs for table ${tableName}`);

    const filteredAPIs = selectedAPIs.length > 0 
      ? generatedAPIs.filter(api => selectedAPIs.includes(`${api.method}-${api.path}`))
      : generatedAPIs;

    logger.info(`Filtered to ${filteredAPIs.length} APIs based on selection`);

    const duplicateAPIs: any[] = [];
    for (const api of filteredAPIs) {
      const existingAPIs = await query(
        'SELECT id, name, path, method FROM apis WHERE path = ? AND method = ?',
        [api.path, api.method]
      );
      if (existingAPIs.length > 0) {
        duplicateAPIs.push({
          name: api.name,
          path: api.path,
          method: api.method,
          existingId: existingAPIs[0].id
        });
      }
    }

    if (duplicateAPIs.length > 0) {
      res.status(409).json({
        success: false,
        error: 'Duplicate APIs detected',
        duplicates: duplicateAPIs,
        message: `${duplicateAPIs.length} API(s) already exist and cannot be created again`
      });
      return;
    }

    const createdAPIs: any[] = [];

    for (const api of filteredAPIs) {
      logger.info(`Processing API: ${api.method} ${api.path}, sql_template: ${api.sql_template}, status: ${status}`);

      const result = await run(
        'INSERT INTO apis (name, path, method, description, datasource_id, sql_template, status, require_auth, category, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          api.name,
          api.path,
          api.method,
          api.description,
          datasourceId,
          api.sql_template,
          status,
          1,
          category,
          req.userId
        ]
      );

      const apiId = result.lastID;

      if (api.parameters && api.parameters.length > 0) {
        for (const param of api.parameters) {
          await run(
            'INSERT INTO api_parameters (api_id, param_name, param_type, data_type, required, default_value, validation_rule, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              apiId,
              param.param_name,
              param.param_type,
              param.data_type,
              param.required,
              param.default_value,
              param.validation_rule,
              param.description
            ]
          );
        }
      }

      createdAPIs.push({
        id: apiId,
        name: api.name,
        path: api.path,
        method: api.method,
        description: api.description
      });
    }

    const timezoneOffset = await getTimezoneOffset();

    await run(
      'INSERT INTO operation_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, status, created_at, timezone_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, 'auto_generate_apis', 'datasource', datasourceId, getClientIp(req), req.get('user-agent'), 'success', getBeijingTime(timezoneOffset), timezoneOffset]
    );

    logger.info(`Auto-generated ${createdAPIs.length} APIs for table ${tableName} by ${req.username}`);

    res.json({
      success: true,
      message: `Successfully generated ${createdAPIs.length} APIs`,
      apis: createdAPIs,
      tableName,
      datasourceId
    });
  } catch (error: any) {
    logger.error('Generate APIs error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate APIs' });
  }
});

router.post('/preview', authorizeRoles('admin', 'developer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { datasourceId, tableName, apiName, apiPath } = req.body;

    if (!datasourceId || !tableName) {
      res.status(400).json({ error: 'datasourceId and tableName are required' });
      return;
    }

    const datasources = await query(
      'SELECT * FROM datasources WHERE id = ?',
      [datasourceId]
    );

    if (datasources.length === 0) {
      res.status(404).json({ error: 'Datasource not found' });
      return;
    }

    const ds = datasources[0];

    const schema = await schemaIntrospector.getTableSchema(datasourceId, ds.type, tableName);

    const generatedAPIs = apiGenerator.generateFullCRUDAPIs(schema, apiName, apiPath);

    res.json({
      success: true,
      tableName,
      datasourceId,
      datasourceName: ds.name,
      apis: generatedAPIs
    });
  } catch (error: any) {
    logger.error('Preview APIs error:', error);
    res.status(500).json({ error: error.message || 'Failed to preview APIs' });
  }
});

export default router;
