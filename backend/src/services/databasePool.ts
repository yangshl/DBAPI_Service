import mysql from 'mysql2/promise';
import pg from 'pg';
import mssql from 'mssql';
import oracledb from 'oracledb';
import { logger } from '../utils/logger';

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  type: 'mysql' | 'postgresql' | 'mssql' | 'oracle';
}

class DatabasePool {
  private mysqlPools: Map<string, mysql.Pool> = new Map();
  private pgPools: Map<string, any> = new Map();
  private mssqlPools: Map<string, any> = new Map();
  private oraclePools: Map<string, any> = new Map();

  async createPool(config: DatabaseConfig, poolName: string): Promise<void> {
    switch (config.type) {
      case 'mysql':
        await this.createMySQLPool(config, poolName);
        break;
      case 'postgresql':
        await this.createPostgreSQLPool(config, poolName);
        break;
      case 'mssql':
        await this.createMSSQLPool(config, poolName);
        break;
      case 'oracle':
        await this.createOraclePool(config, poolName);
        break;
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  private async createMySQLPool(config: DatabaseConfig, poolName: string): Promise<void> {
    if (this.mysqlPools.has(poolName)) {
      throw new Error(`MySQL pool ${poolName} already exists`);
    }

    const poolConfig = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.MAX_CONNECTIONS || '10'),
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: '+08:00'
    };

    const pool = mysql.createPool(poolConfig);
    this.mysqlPools.set(poolName, pool);
    logger.info(`Created MySQL pool: ${poolName}`);
  }

  private async createPostgreSQLPool(config: DatabaseConfig, poolName: string): Promise<void> {
    if (this.pgPools.has(poolName)) {
      throw new Error(`PostgreSQL pool ${poolName} already exists`);
    }

    const pool = new pg.Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      max: parseInt(process.env.MAX_CONNECTIONS || '10'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    pool.on('connect', (client: any) => {
      client.query("SET TIME ZONE 'Asia/Shanghai'");
    });

    this.pgPools.set(poolName, pool);
    logger.info(`Created PostgreSQL pool: ${poolName}`);
  }

  private async createMSSQLPool(config: DatabaseConfig, poolName: string): Promise<void> {
    if (this.mssqlPools.has(poolName)) {
      throw new Error(`MSSQL pool ${poolName} already exists`);
    }

    const pool = await mssql.connect({
      server: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      pool: {
        max: parseInt(process.env.MAX_CONNECTIONS || '10'),
        min: 0,
        idleTimeoutMillis: 30000
      },
      options: {
        trustServerCertificate: true,
        enableArithAbort: true
      },
      requestTimeout: 15000
    });

    await pool.query("SET TIMEZONE = 'China Standard Time'");

    this.mssqlPools.set(poolName, pool);
    logger.info(`Created MSSQL pool: ${poolName}`);
  }

  private async createOraclePool(config: DatabaseConfig, poolName: string): Promise<void> {
    if (this.oraclePools.has(poolName)) {
      throw new Error(`Oracle pool ${poolName} already exists`);
    }

    try {
      await oracledb.initClient();
    } catch (err) {
      logger.warn('Oracle client already initialized or not available');
    }

    const pool = await oracledb.createPool({
      user: config.user,
      password: config.password,
      connectString: `${config.host}:${config.port}/${config.database}`,
      poolMin: 0,
      poolMax: parseInt(process.env.MAX_CONNECTIONS || '10'),
      poolIncrement: 1,
      poolTimeout: 60,
      sessionCallback: async (connection: any) => {
        await connection.execute(`ALTER SESSION SET TIME_ZONE = 'Asia/Shanghai'`);
      }
    });

    this.oraclePools.set(poolName, pool);
    logger.info(`Created Oracle pool: ${poolName}`);
  }

  async getPool(poolName: string, type: 'mysql' | 'postgresql' | 'mssql' | 'oracle'): Promise<any> {
    switch (type) {
      case 'mysql':
        return this.getMySQLPool(poolName);
      case 'postgresql':
        return this.getPostgreSQLPool(poolName);
      case 'mssql':
        return this.getMSSQLPool(poolName);
      case 'oracle':
        return this.getOraclePool(poolName);
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }

  private async getMySQLPool(poolName: string): Promise<mysql.Pool> {
    const pool = this.mysqlPools.get(poolName);
    if (!pool) {
      throw new Error(`MySQL pool ${poolName} not found`);
    }
    return pool;
  }

  private async getPostgreSQLPool(poolName: string): Promise<any> {
    const pool = this.pgPools.get(poolName);
    if (!pool) {
      throw new Error(`PostgreSQL pool ${poolName} not found`);
    }
    return pool;
  }

  private async getMSSQLPool(poolName: string): Promise<any> {
    const pool = this.mssqlPools.get(poolName);
    if (!pool) {
      throw new Error(`MSSQL pool ${poolName} not found`);
    }
    return pool;
  }

  private async getOraclePool(poolName: string): Promise<any> {
    const pool = this.oraclePools.get(poolName);
    if (!pool) {
      throw new Error(`Oracle pool ${poolName} not found`);
    }
    return pool;
  }

  async executeQuery(poolName: string, sql: string, params?: any[], type?: 'mysql' | 'postgresql' | 'mssql' | 'oracle'): Promise<any> {
    try {
      const pool = await this.getPool(poolName, type || 'mysql');
      
      if (type === 'mysql') {
        const mysqlPool = pool as mysql.Pool;
        const [results] = await mysqlPool.execute(sql, params);
        return results;
      } else if (type === 'postgresql') {
        const pgPool = pool as any;
        const result = await pgPool.query(sql, params);
        return result.rows;
      } else if (type === 'mssql') {
        const mssqlPool = pool as any;
        const request = mssqlPool.request();
        
        if (params && params.length > 0) {
          params.forEach((param, index) => {
            request.input(`param${index}`, param);
          });
          
          let paramSql = sql;
          params.forEach((_, index) => {
            paramSql = paramSql.replace('?', `@param${index}`);
          });
          
          const result = await request.query(paramSql);
          return result.recordset;
        } else {
          const result = await request.query(sql);
          return result.recordset;
        }
      } else if (type === 'oracle') {
        const oraclePool = pool as any;
        const connection = await oraclePool.getConnection();
        
        try {
          const result = await connection.execute(sql, params);
          return result.rows;
        } finally {
          await connection.close();
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Query execution failed for pool ${poolName}:`, error);
      throw error;
    }
  }

  async testConnection(config: DatabaseConfig): Promise<boolean> {
    try {
      switch (config.type) {
        case 'mysql':
          return await this.testMySQLConnection(config);
        case 'postgresql':
          return await this.testPostgreSQLConnection(config);
        case 'mssql':
          return await this.testMSSQLConnection(config);
        case 'oracle':
          return await this.testOracleConnection(config);
        default:
          throw new Error(`Unsupported database type: ${config.type}`);
      }
    } catch (error) {
      logger.error(`Connection test failed for ${config.host}:${config.port}:`, error);
      return false;
    }
  }

  private async testMySQLConnection(config: DatabaseConfig): Promise<boolean> {
    try {
      const testPool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 1
      });

      const connection = await testPool.getConnection();
      await connection.ping();
      connection.release();
      await testPool.end();

      logger.info(`MySQL connection test successful for ${config.host}:${config.port}`);
      return true;
    } catch (error) {
      logger.error(`MySQL connection test failed for ${config.host}:${config.port}:`, error);
      return false;
    }
  }

  private async testPostgreSQLConnection(config: DatabaseConfig): Promise<boolean> {
    try {
      const client = new pg.Client({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectionTimeoutMillis: 5000
      });

      await client.connect();
      await client.query('SELECT NOW()');
      await client.end();

      logger.info(`PostgreSQL connection test successful for ${config.host}:${config.port}`);
      return true;
    } catch (error) {
      logger.error(`PostgreSQL connection test failed for ${config.host}:${config.port}:`, error);
      return false;
    }
  }

  private async testMSSQLConnection(config: DatabaseConfig): Promise<boolean> {
    try {
      const pool = await mssql.connect({
        server: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        options: {
          trustServerCertificate: true,
          enableArithAbort: true
        },
        connectionTimeout: 5000
      });

      await pool.query('SELECT GETDATE()');
      await pool.close();

      logger.info(`MSSQL connection test successful for ${config.host}:${config.port}`);
      return true;
    } catch (error) {
      logger.error(`MSSQL connection test failed for ${config.host}:${config.port}:`, error);
      return false;
    }
  }

  private async testOracleConnection(config: DatabaseConfig): Promise<boolean> {
    try {
      try {
        await oracledb.initClient();
      } catch (err) {
        logger.warn('Oracle client already initialized or not available');
      }

      const connection = await oracledb.getConnection({
        user: config.user,
        password: config.password,
        connectString: `${config.host}:${config.port}/${config.database}`
      });

      await connection.execute('SELECT SYSDATE FROM DUAL');
      await connection.close();

      logger.info(`Oracle connection test successful for ${config.host}:${config.port}`);
      return true;
    } catch (error) {
      logger.error(`Oracle connection test failed for ${config.host}:${config.port}:`, error);
      return false;
    }
  }

  async closePool(poolName: string, type: 'mysql' | 'postgresql' | 'mssql' | 'oracle'): Promise<void> {
    switch (type) {
      case 'mysql':
        await this.closeMySQLPool(poolName);
        break;
      case 'postgresql':
        await this.closePostgreSQLPool(poolName);
        break;
      case 'mssql':
        await this.closeMSSQLPool(poolName);
        break;
      case 'oracle':
        await this.closeOraclePool(poolName);
        break;
    }
  }

  private async closeMySQLPool(poolName: string): Promise<void> {
    const pool = this.mysqlPools.get(poolName);
    if (pool) {
      await pool.end();
      this.mysqlPools.delete(poolName);
      logger.info(`Closed MySQL pool: ${poolName}`);
    }
  }

  private async closePostgreSQLPool(poolName: string): Promise<void> {
    const pool = this.pgPools.get(poolName);
    if (pool) {
      await pool.end();
      this.pgPools.delete(poolName);
      logger.info(`Closed PostgreSQL pool: ${poolName}`);
    }
  }

  private async closeMSSQLPool(poolName: string): Promise<void> {
    const pool = this.mssqlPools.get(poolName);
    if (pool) {
      await pool.close();
      this.mssqlPools.delete(poolName);
      logger.info(`Closed MSSQL pool: ${poolName}`);
    }
  }

  private async closeOraclePool(poolName: string): Promise<void> {
    const pool = this.oraclePools.get(poolName);
    if (pool) {
      await pool.close();
      this.oraclePools.delete(poolName);
      logger.info(`Closed Oracle pool: ${poolName}`);
    }
  }

  async closeAllPools(): Promise<void> {
    const promises = [
      ...Array.from(this.mysqlPools.entries()).map(([name, pool]) => {
        return pool.end().then(() => {
          this.mysqlPools.delete(name);
          logger.info(`Closed MySQL pool: ${name}`);
        });
      }),
      ...Array.from(this.pgPools.entries()).map(([name, pool]) => {
        return pool.end().then(() => {
          this.pgPools.delete(name);
          logger.info(`Closed PostgreSQL pool: ${name}`);
        });
      }),
      ...Array.from(this.mssqlPools.entries()).map(([name, pool]) => {
        return pool.close().then(() => {
          this.mssqlPools.delete(name);
          logger.info(`Closed MSSQL pool: ${name}`);
        });
      }),
      ...Array.from(this.oraclePools.entries()).map(([name, pool]) => {
        return pool.close().then(() => {
          this.oraclePools.delete(name);
          logger.info(`Closed Oracle pool: ${name}`);
        });
      })
    ];

    await Promise.all(promises);
  }

  getPoolNames(): string[] {
    return [
      ...Array.from(this.mysqlPools.keys()),
      ...Array.from(this.pgPools.keys()),
      ...Array.from(this.mssqlPools.keys()),
      ...Array.from(this.oraclePools.keys())
    ];
  }
}

export const databasePool = new DatabasePool();
