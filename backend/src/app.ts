import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initDatabase, query } from './config/database';
import { logger } from './utils/logger';
import { rateLimiter, loginRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { databasePool } from './services/databasePool';

import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import datasourceRoutes from './routes/datasource';
import userRoutes from './routes/user';
import logRoutes from './routes/log';
import statsRoutes from './routes/stats';
import executeRoutes, { initPublicPaths } from './routes/execute';
import apiGeneratorRoutes from './routes/apiGenerator';
import permissionRoutes from './routes/permission';
import docsRoutes from './routes/docs';
import systemConfigRoutes from './routes/systemConfig';

dotenv.config();

const app: Application = express();
let PORT = process.env.PORT || 3000;
let HOST = process.env.HOST || '0.0.0.0';

app.set('trust proxy', true);
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(rateLimiter);
app.use(requestLogger);

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/debug/ip', (req: Request, res: Response) => {
  const headers = {
    'x-forwarded-for': req.headers['x-forwarded-for'],
    'x-real-ip': req.headers['x-real-ip'],
    'cf-connecting-ip': req.headers['cf-connecting-ip'],
    'true-client-ip': req.headers['true-client-ip'],
    'x-cluster-client-ip': req.headers['x-cluster-client-ip'],
    'remote-addr': req.connection?.remoteAddress,
    'req-ip': req.ip,
  };
  
  res.json({
    timestamp: new Date().toISOString(),
    clientIp: req.ip,
    remoteAddress: req.connection?.remoteAddress,
    headers: headers,
    proxyTrust: app.get('trust proxy')
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/apis', apiRoutes);
app.use('/api/datasources', datasourceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/generator', apiGeneratorRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/system', systemConfigRoutes);
app.use('/', executeRoutes);

app.use(errorHandler);

const server = createServer(app);

async function startServer() {
  try {
    await initDatabase();
    logger.info('Database initialized successfully');

    initPublicPaths();

    const serverIpSetting = await query(
      'SELECT * FROM system_settings WHERE key = ?',
      ['server_ip']
    );
    if (serverIpSetting.length > 0) {
      HOST = serverIpSetting[0].value;
      logger.info(`Loaded server IP from settings: ${HOST}`);
    }

    const serverPortSetting = await query(
      'SELECT * FROM system_settings WHERE key = ?',
      ['server_port']
    );
    if (serverPortSetting.length > 0) {
      PORT = parseInt(serverPortSetting[0].value, 10);
      logger.info(`Loaded server port from settings: ${PORT}`);
    }

    const serverDomainSetting = await query(
      'SELECT * FROM system_settings WHERE key = ?',
      ['server_domain']
    );
    if (serverDomainSetting.length > 0 && serverDomainSetting[0].value) {
      logger.info(`Loaded server domain from settings: ${serverDomainSetting[0].value}`);
    }

    const datasources = await query(
      'SELECT * FROM datasources WHERE status = ?',
      ['active']
    );

    for (const ds of datasources) {
      try {
        await databasePool.createPool({
          type: ds.type,
          host: ds.host,
          port: ds.port,
          user: ds.username,
          password: ds.password,
          database: ds.database_name
        }, `ds_${ds.id}`);
        logger.info(`Initialized connection pool for datasource: ${ds.name}`);
      } catch (error) {
        logger.error(`Failed to initialize connection pool for datasource ${ds.name}:`, error);
      }
    }

    server.listen(Number(PORT), HOST, () => {
      logger.info(`Server is running on http://${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
