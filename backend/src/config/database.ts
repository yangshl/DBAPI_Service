import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';

let db: Database | null = null;

export function getBeijingTime(timezoneOffset: number = 8): string {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const targetTime = new Date(utc + (3600000 * timezoneOffset));
  
  const year = targetTime.getFullYear();
  const month = String(targetTime.getMonth() + 1).padStart(2, '0');
  const day = String(targetTime.getDate()).padStart(2, '0');
  const hours = String(targetTime.getHours()).padStart(2, '0');
  const minutes = String(targetTime.getMinutes()).padStart(2, '0');
  const seconds = String(targetTime.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export async function getTimezoneOffset(): Promise<number> {
  if (!db) throw new Error('Database not initialized');
  
  const setting = await db.get('SELECT value FROM system_settings WHERE key = ?', ['timezone_offset']);
  return setting ? parseInt(setting.value, 10) : 8;
}

export async function initDatabase(): Promise<void> {
  try {
    db = await open({
      filename: './dbapi_service.db',
      driver: sqlite3.Database
    });

    await db.exec("PRAGMA time_zone = '+08:00'");
    
    await createTables();
    await addTimezoneOffsetFields();
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

async function createTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT CHECK(role IN ('admin', 'developer', 'viewer')) DEFAULT 'developer',
      status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
      api_token TEXT,
      token_expires_at TIMESTAMP,
      token_permissions TEXT,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS datasources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('mysql', 'postgresql', 'mssql', 'oracle')) NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      database_name TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
      created_by INTEGER,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS apis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      method TEXT CHECK(method IN ('GET', 'POST', 'PUT', 'DELETE')) DEFAULT 'GET',
      description TEXT,
      datasource_id INTEGER NOT NULL,
      sql_template TEXT NOT NULL,
      status TEXT CHECK(status IN ('draft', 'published', 'deprecated')) DEFAULT 'draft',
      require_auth INTEGER DEFAULT 1,
      category TEXT DEFAULT 'default',
      created_by INTEGER,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (datasource_id) REFERENCES datasources(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (path, method)
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_parameters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_id INTEGER NOT NULL,
      param_name TEXT NOT NULL,
      param_type TEXT CHECK(param_type IN ('path', 'query', 'body')) NOT NULL,
      data_type TEXT CHECK(data_type IN ('string', 'number', 'boolean', 'date')) NOT NULL,
      required INTEGER DEFAULT 0,
      default_value TEXT,
      validation_rule TEXT,
      description TEXT,
      created_at TIMESTAMP,
      FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id INTEGER,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT CHECK(status IN ('success', 'failure')) DEFAULT 'success',
      error_message TEXT,
      created_at TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_id INTEGER NOT NULL,
      user_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      request_params TEXT,
      response_status INTEGER,
      execution_time INTEGER,
      status TEXT CHECK(status IN ('success', 'failure')) DEFAULT 'success',
      error_message TEXT,
      created_at TIMESTAMP,
      FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_call_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_id INTEGER NOT NULL,
      call_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      avg_response_time REAL DEFAULT 0,
      last_called_at TIMESTAMP,
      date TEXT NOT NULL,
      FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE,
      UNIQUE (api_id, date)
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS data_masking_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      datasource_id INTEGER NOT NULL,
      table_name TEXT NOT NULL,
      column_name TEXT NOT NULL,
      mask_type TEXT CHECK(mask_type IN ('partial', 'full', 'custom')) NOT NULL,
      mask_pattern TEXT,
      created_by INTEGER,
      created_at TIMESTAMP,
      FOREIGN KEY (datasource_id) REFERENCES datasources(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('menu', 'button')) NOT NULL,
      resource TEXT NOT NULL,
      action TEXT,
      parent_id INTEGER,
      path TEXT,
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      description TEXT,
      status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES permissions(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      permission_id INTEGER NOT NULL,
      created_at TIMESTAMP,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE (role, permission_id)
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
      created_by INTEGER,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ip_whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      description TEXT,
      enabled INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      description TEXT,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `);

  const adminExists = await db.get('SELECT 1 FROM users WHERE username = ?', ['admin']);
  if (!adminExists) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const now = getBeijingTime();
    await db.run(
      'INSERT INTO users (username, password, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['admin', adminPassword, 'admin@dbapi.com', 'admin', now, now]
    );
  }

  await initDefaultPermissions();

  await initDefaultSystemSettings();

  logger.info('Database tables created successfully');
}

async function initDefaultPermissions(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  const now = getBeijingTime();

  const defaultPermissions = [
    { code: 'dashboard', name: '仪表盘', type: 'menu', resource: 'dashboard', path: '/dashboard', icon: 'DashboardOutlined', sort_order: 1 },
    { code: 'api_view', name: 'API管理', type: 'menu', resource: 'api', path: '/apis', icon: 'ApiOutlined', sort_order: 2 },
    { code: 'api_create', name: '创建API', type: 'button', resource: 'api', action: 'create', sort_order: 3 },
    { code: 'api_edit', name: '编辑API', type: 'button', resource: 'api', action: 'edit', sort_order: 4 },
    { code: 'api_delete', name: '删除API', type: 'button', resource: 'api', action: 'delete', sort_order: 5 },
    { code: 'api_publish', name: '发布API', type: 'button', resource: 'api', action: 'publish', sort_order: 6 },
    { code: 'datasource_view', name: '数据源管理', type: 'menu', resource: 'datasource', path: '/datasources', icon: 'DatabaseOutlined', sort_order: 7 },
    { code: 'datasource_create', name: '创建数据源', type: 'button', resource: 'datasource', action: 'create', sort_order: 8 },
    { code: 'datasource_edit', name: '编辑数据源', type: 'button', resource: 'datasource', action: 'edit', sort_order: 9 },
    { code: 'datasource_delete', name: '删除数据源', type: 'button', resource: 'datasource', action: 'delete', sort_order: 10 },
    { code: 'user_view', name: '用户管理', type: 'menu', resource: 'user', path: '/users', icon: 'UserOutlined', sort_order: 11 },
    { code: 'user_create', name: '创建用户', type: 'button', resource: 'user', action: 'create', sort_order: 12 },
    { code: 'user_edit', name: '编辑用户', type: 'button', resource: 'user', action: 'edit', sort_order: 13 },
    { code: 'user_delete', name: '删除用户', type: 'button', resource: 'user', action: 'delete', sort_order: 14 },
    { code: 'user_password', name: '设置密码', type: 'button', resource: 'user', action: 'password', sort_order: 15 },
    { code: 'log_view', name: '操作日志', type: 'menu', resource: 'log', path: '/logs', icon: 'FileTextOutlined', sort_order: 16 },
    { code: 'permission_view', name: '权限管理', type: 'menu', resource: 'permission', path: '/permissions', icon: 'SafetyOutlined', sort_order: 17 },
    { code: 'permission_edit', name: '编辑权限', type: 'button', resource: 'permission', action: 'edit', sort_order: 18 },
    { code: 'system_config', name: '系统配置', type: 'menu', resource: 'system', path: '/system', icon: 'SettingOutlined', sort_order: 19 }
  ];

  for (const perm of defaultPermissions) {
    const existing = await db.get('SELECT id FROM permissions WHERE code = ?', [perm.code]);
    if (!existing) {
      await db.run(
        'INSERT INTO permissions (code, name, type, resource, action, path, icon, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [perm.code, perm.name, perm.type, perm.resource, perm.action, perm.path, perm.icon, perm.sort_order, 'active', now, now]
      );
    }
  }

  const adminRolePerms = await db.get('SELECT COUNT(*) as count FROM role_permissions WHERE role = ?', ['admin']);
  if (adminRolePerms.count === 0) {
    const allPermissions = await db.all('SELECT id FROM permissions');
    for (const perm of allPermissions) {
      await db.run(
        'INSERT INTO role_permissions (role, permission_id, created_at) VALUES (?, ?, ?)',
        ['admin', perm.id, now]
      );
    }
  }

  const developerRolePerms = await db.get('SELECT COUNT(*) as count FROM role_permissions WHERE role = ?', ['developer']);
  if (developerRolePerms.count === 0) {
    const developerPerms = ['dashboard', 'api_view', 'api_create', 'api_edit', 'api_publish', 'datasource_view', 'datasource_create', 'datasource_edit', 'log_view'];
    for (const code of developerPerms) {
      const perm = await db.get('SELECT id FROM permissions WHERE code = ?', [code]);
      if (perm) {
        await db.run(
          'INSERT INTO role_permissions (role, permission_id, created_at) VALUES (?, ?, ?)',
          ['developer', perm.id, now]
        );
      }
    }
  }

  const viewerRolePerms = await db.get('SELECT COUNT(*) as count FROM role_permissions WHERE role = ?', ['viewer']);
  if (viewerRolePerms.count === 0) {
    const viewerPerms = ['dashboard', 'api_view', 'datasource_view', 'log_view'];
    for (const code of viewerPerms) {
      const perm = await db.get('SELECT id FROM permissions WHERE code = ?', [code]);
      if (perm) {
        await db.run(
          'INSERT INTO role_permissions (role, permission_id, created_at) VALUES (?, ?, ?)',
          ['viewer', perm.id, now]
        );
      }
    }
  }
}

async function initDefaultSystemSettings(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  const now = getBeijingTime();

  const defaultSettings = [
    { key: 'server_ip', value: '0.0.0.0', description: '服务器监听IP地址，0.0.0.0表示监听所有网卡' },
    { key: 'server_port', value: '3000', description: '服务器监听端口' },
    { key: 'server_domain', value: '', description: '服务器监听域名，留空则不限制域名' },
    { key: 'ip_whitelist_enabled', value: 'false', description: '是否启用IP白名单' },
    { key: 'timezone_offset', value: '8', description: '时区偏移小时数，例如：北京时间为8，纽约为-5' }
  ];

  for (const setting of defaultSettings) {
    const existing = await db.get('SELECT id FROM system_settings WHERE key = ?', [setting.key]);
    if (!existing) {
      await db.run(
        'INSERT INTO system_settings (key, value, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [setting.key, setting.value, setting.description, now, now]
      );
    }
  }
}

async function addTimezoneOffsetFields(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  const tables = [
    { table: 'apis', field: 'timezone_offset' },
    { table: 'datasources', field: 'timezone_offset' },
    { table: 'api_access_logs', field: 'timezone_offset' },
    { table: 'operation_logs', field: 'timezone_offset' }
  ];

  for (const { table, field } of tables) {
    try {
      const columns = await db.all(`PRAGMA table_info(${table})`);
      const hasField = columns && columns.some((col: any) => col.name === field);
      
      if (!hasField) {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${field} INTEGER DEFAULT 8`);
        logger.info(`Added ${field} field to ${table} table`);
      }
    } catch (error) {
      logger.error(`Failed to add ${field} to ${table}:`, error);
    }
  }
}

export async function query(sql: string, params?: any[]): Promise<any> {
  if (!db) throw new Error('Database not initialized');
  
  const results = await db.all(sql, params || []);
  return results;
}

export async function get(sql: string, params?: any[]): Promise<any> {
  if (!db) throw new Error('Database not initialized');
  
  const result = await db.get(sql, params || []);
  return result;
}

export async function run(sql: string, params?: any[]): Promise<any> {
  if (!db) throw new Error('Database not initialized');
  
  const result = await db.run(sql, params || []);
  return result;
}

export function getDb(): Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}
