import { Router, Response } from 'express';
import { query, getBeijingTime, getTimezoneOffset } from '../config/database';
import { logger } from '../utils/logger';
import { databasePool } from '../services/databasePool';
import { AuthRequest, optionalApiTokenAuth } from '../middleware/auth';
import { validationService } from '../services/validationService';
import { getClientIp } from '../utils/ipHelper';
import { checkIpWhitelist } from '../middleware/ipWhitelist';

const router = Router();

function checkApiPermission(tokenPermissions: any, api: any): boolean {
  if (!tokenPermissions || tokenPermissions.type !== 'categories') {
    return false;
  }

  const { apis = [] } = tokenPermissions;

  if (!Array.isArray(apis) || apis.length === 0) {
    return false;
  }

  return apis.includes(api.id);
}

const publicPaths = new Set<string>();

async function loadPublicPaths() {
  try {
    const apis = await query('SELECT path FROM apis WHERE status = ?', ['published']);
    if (Array.isArray(apis)) {
      apis.forEach((api: any) => {
        publicPaths.add(api.path);
      });
    }
  } catch (error) {
    logger.error('Failed to load public paths:', error);
  }
}

setInterval(loadPublicPaths, 60000);

export function initPublicPaths() {
  loadPublicPaths();
}

router.use(optionalApiTokenAuth);
router.use(checkIpWhitelist);

async function findMatchingAPI(path: string, method: string): Promise<any> {
  const apis = await query(
    'SELECT a.id, a.name, a.path, a.method, a.description, a.datasource_id, a.sql_template, a.status, a.require_auth, a.category, a.created_by, a.created_at, a.updated_at, d.id as ds_id, d.name as ds_name, d.type, d.host, d.port, d.database_name, d.username, d.password, d.status as ds_status FROM apis a LEFT JOIN datasources d ON a.datasource_id = d.id WHERE a.method = ? AND a.status = ?',
    [method, 'published']
  );

  const requestPathSegments = path.split('/').filter(Boolean);

  const fixedPathAPIs: any[] = [];
  const paramPathAPIs: any[] = [];

  for (const api of apis) {
    const apiPath = api.path;
    const apiPathSegments = apiPath.split('/').filter(Boolean);

    if (apiPathSegments.length !== requestPathSegments.length) {
      continue;
    }

    const hasParams = apiPathSegments.some((seg: string) => seg.startsWith(':'));
    if (hasParams) {
      paramPathAPIs.push(api);
    } else {
      fixedPathAPIs.push(api);
    }
  }

  const allAPIs = [...fixedPathAPIs, ...paramPathAPIs];

  for (const api of allAPIs) {
    const apiPath = api.path;
    const apiPathSegments = apiPath.split('/').filter(Boolean);

    let match = true;
    const pathParams: Record<string, string> = {};

    for (let i = 0; i < apiPathSegments.length; i++) {
      const apiSegment = apiPathSegments[i];
      const requestSegment = requestPathSegments[i];

      if (apiSegment.startsWith(':')) {
        const paramName = apiSegment.substring(1);
        pathParams[paramName] = requestSegment;
      } else if (apiSegment !== requestSegment) {
        match = false;
        break;
      }
    }

    if (match) {
      return { api, pathParams };
    }
  }

  return null;
}

router.all('/:path(*)', async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    let path = req.params.path;
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    const method = req.method.toUpperCase();

    const matchResult = await findMatchingAPI(path, method);

    if (!matchResult) {
      res.status(404).json({ error: 'API not found' });
      return;
    }

    const { api, pathParams } = matchResult;
    req.apiId = api.id;
    req.apiPath = api.path;
    Object.assign(req.params, pathParams);

    if (api.ds_status !== 'active') {
      const ipAddress = getClientIp(req);
      const userAgent = req.get('user-agent') || '';
      const allParams = { ...req.params, ...req.query, ...req.body };
      const timezoneOffset = await getTimezoneOffset();
      const now = getBeijingTime(timezoneOffset);
      const today = now.split(' ')[0];

      await query(`
        INSERT INTO api_access_logs (api_id, user_id, ip_address, user_agent, request_params, response_status, execution_time, status, error_message, created_at, timezone_offset)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [api.id, req.userId || null, ipAddress, userAgent, JSON.stringify(allParams), 503, 0, 'failure', 'Datasource is not active', now, timezoneOffset]);

      await query(`
        INSERT INTO api_call_stats (api_id, call_count, success_count, failure_count, avg_response_time, last_called_at, date)
        VALUES (?, 1, 0, 1, 0, ?, ?)
        ON CONFLICT(api_id, date) DO UPDATE SET
          call_count = call_count + 1,
          failure_count = failure_count + 1,
          last_called_at = ?
      `, [api.id, now, today, now]);

      res.status(503).json({ 
        success: false,
        error: 'Datasource is not active',
        datasource: api.ds_name
      });
      return;
    }

    if (typeof req.tokenPermissions === 'string') {
      try {
        req.tokenPermissions = JSON.parse(req.tokenPermissions);
      } catch (e) {
        logger.error('Failed to parse tokenPermissions:', e);
      }
    }

    if (api.require_auth === 1) {
        if (!req.userId) {
          const ipAddress = getClientIp(req);
          const userAgent = req.get('user-agent') || '';
          const allParams = { ...req.params, ...req.query, ...req.body };
          const timezoneOffset = await getTimezoneOffset();
          const now = getBeijingTime(timezoneOffset);
          const today = now.split(' ')[0];

        await query(`
          INSERT INTO api_access_logs (api_id, user_id, ip_address, user_agent, request_params, response_status, execution_time, status, error_message, created_at, timezone_offset)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [api.id, null, ipAddress, userAgent, JSON.stringify(allParams), 401, 0, 'failure', 'Authentication required', now, timezoneOffset]);

        await query(`
          INSERT INTO api_call_stats (api_id, call_count, success_count, failure_count, avg_response_time, last_called_at, date)
          VALUES (?, 1, 0, 1, 0, ?, ?)
          ON CONFLICT(api_id, date) DO UPDATE SET
            call_count = call_count + 1,
            failure_count = failure_count + 1,
            last_called_at = ?
        `, [api.id, now, today, now]);

        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const hasPermission = checkApiPermission(req.tokenPermissions, api);
      if (!hasPermission) {
        const ipAddress = getClientIp(req);
        const userAgent = req.get('user-agent') || '';
        const allParams = { ...req.params, ...req.query, ...req.body };
        const timezoneOffset = await getTimezoneOffset();
        const now = getBeijingTime(timezoneOffset);
        const today = now.split(' ')[0];

        await query(`
          INSERT INTO api_access_logs (api_id, user_id, ip_address, user_agent, request_params, response_status, execution_time, status, error_message, created_at, timezone_offset)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [api.id, req.userId, ipAddress, userAgent, JSON.stringify(allParams), 403, 0, 'failure', 'Permission denied', now, timezoneOffset]);

        await query(`
          INSERT INTO api_call_stats (api_id, call_count, success_count, failure_count, avg_response_time, last_called_at, date)
          VALUES (?, 1, 0, 1, 0, ?, ?)
          ON CONFLICT(api_id, date) DO UPDATE SET
            call_count = call_count + 1,
            failure_count = failure_count + 1,
            last_called_at = ?
        `, [api.id, now, today, now]);

        res.status(403).json({ error: 'Permission denied' });
        return;
      }
    }

    const startTime = Date.now();

    let sql = api.sql_template;
    const queryParams: any[] = [];

    const allParams = { ...req.params, ...req.query, ...req.body };

    const validationResult = await validationService.validateAndSanitizeRequest(api.id, allParams);
    if (!validationResult.valid) {
      const ipAddress = getClientIp(req);
      const userAgent = req.get('user-agent') || '';
      const timezoneOffset = await getTimezoneOffset();
      const now = getBeijingTime(timezoneOffset);
      const today = now.split(' ')[0];

      await query(`
        INSERT INTO api_access_logs (api_id, user_id, ip_address, user_agent, request_params, response_status, execution_time, status, error_message, created_at, timezone_offset)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [api.id, req.userId || null, ipAddress, userAgent, JSON.stringify(allParams), 400, 0, 'failure', JSON.stringify(validationResult.errors), now, timezoneOffset]);

      await query(`
        INSERT INTO api_call_stats (api_id, call_count, success_count, failure_count, avg_response_time, last_called_at, date)
        VALUES (?, 1, 0, 1, 0, ?, ?)
        ON CONFLICT(api_id, date) DO UPDATE SET
          call_count = call_count + 1,
          failure_count = failure_count + 1,
          last_called_at = ?
      `, [api.id, now, today, now]);

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.errors
      });
      return;
    }

    const sanitizedParams = validationResult.sanitizedParams || allParams;

    const directReplaceParams = ['order_by', 'order', 'limit'];
    const searchParam = 'search';
    
    for (const [key, value] of Object.entries(sanitizedParams)) {
      const placeholder = `{{${key}}}`;
      if (sql.includes(placeholder)) {
        if (key === searchParam) {
          const escapedValue = String(value).replace(/'/g, "''");
          const replaceValue = `'%${escapedValue}%'`;
          sql = sql.replace(new RegExp(placeholder, 'g'), replaceValue);
        } else if (directReplaceParams.includes(key)) {
          let replaceValue = String(value);
          sql = sql.replace(new RegExp(placeholder, 'g'), replaceValue);
        } else {
          sql = sql.replace(new RegExp(placeholder, 'g'), '?');
          queryParams.push(value);
        }
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

    const results = await databasePool.executeQuery(`ds_${api.datasource_id}`, sql, queryParams, api.type);
    const executionTime = Date.now() - startTime;

    const userId = req.userId || null;
    const ipAddress = getClientIp(req);
    const userAgent = req.get('user-agent') || '';
    const timezoneOffset = await getTimezoneOffset();
    const now = getBeijingTime(timezoneOffset);
    const today = now.split(' ')[0];

    await query(`
      INSERT INTO api_access_logs (api_id, user_id, ip_address, user_agent, request_params, response_status, execution_time, status, created_at, timezone_offset)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [api.id, userId, ipAddress, userAgent, JSON.stringify(allParams), 200, executionTime, 'success', now, timezoneOffset]);

    await query(`
      INSERT INTO api_call_stats (api_id, call_count, success_count, failure_count, avg_response_time, last_called_at, date)
      VALUES (?, 1, 1, 0, ?, ?, ?)
      ON CONFLICT(api_id, date) DO UPDATE SET
        call_count = call_count + 1,
        success_count = success_count + 1,
        avg_response_time = (avg_response_time * (call_count - 1) + ?) / call_count,
        last_called_at = ?
    `, [api.id, executionTime, now, today, executionTime, now]);

    res.json({
      success: true,
      data: results,
      meta: {
        executionTime: `${executionTime}ms`,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Execute API error:', error);

    try {
      const apis = await query(
        'SELECT id FROM apis WHERE path = ? AND method = ?',
        [`/${req.params.path}`, req.method.toUpperCase()]
      );

      if (apis.length > 0) {
        const userId = req.userId || null;
        const ipAddress = getClientIp(req);
        const userAgent = req.get('user-agent') || '';
        const timezoneOffset = await getTimezoneOffset();
        const now = getBeijingTime(timezoneOffset);
        const today = now.split(' ')[0];

        await query(`
          INSERT INTO api_access_logs (api_id, user_id, ip_address, user_agent, request_params, response_status, execution_time, status, error_message, created_at, timezone_offset)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [apis[0].id, userId, ipAddress, userAgent, JSON.stringify(req.query), 500, 0, 'failure', error.message || 'Unknown error', now, timezoneOffset]);

        await query(`
          INSERT INTO api_call_stats (api_id, call_count, success_count, failure_count, avg_response_time, last_called_at, date)
          VALUES (?, 1, 0, 1, 0, ?, ?)
          ON CONFLICT(api_id, date) DO UPDATE SET
            call_count = call_count + 1,
            failure_count = failure_count + 1,
            last_called_at = ?
        `, [apis[0].id, now, today, now]);
      }
    } catch (logError) {
      logger.error('Failed to log API call failure:', logError);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute API'
    });
  }
});

export default router;
