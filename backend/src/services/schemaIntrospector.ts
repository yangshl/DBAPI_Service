import { databasePool } from './databasePool';
import { logger } from '../utils/logger';

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  defaultValue?: any;
  maxLength?: number;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

export interface DatabaseSchema {
  tables: TableInfo[];
}

class SchemaIntrospector {
  async getTables(datasourceId: number, dbType: string): Promise<TableInfo[]> {
    const poolName = `ds_${datasourceId}`;
    
    try {
      switch (dbType) {
        case 'mysql':
          return await this.getMySQLTables(poolName);
        case 'postgresql':
          return await this.getPostgreSQLTables(poolName);
        case 'mssql':
          return await this.getMSSQLTables(poolName);
        case 'oracle':
          return await this.getOracleTables(poolName);
        default:
          throw new Error(`Unsupported database type: ${dbType}`);
      }
    } catch (error) {
      logger.error(`Failed to get tables for datasource ${datasourceId}:`, error);
      throw error;
    }
  }

  async getTableSchema(datasourceId: number, dbType: string, tableName: string): Promise<TableInfo> {
    const poolName = `ds_${datasourceId}`;
    
    try {
      switch (dbType) {
        case 'mysql':
          return await this.getMySQLTableSchema(poolName, tableName);
        case 'postgresql':
          return await this.getPostgreSQLTableSchema(poolName, tableName);
        case 'mssql':
          return await this.getMSSQLTableSchema(poolName, tableName);
        case 'oracle':
          return await this.getOracleTableSchema(poolName, tableName);
        default:
          throw new Error(`Unsupported database type: ${dbType}`);
      }
    } catch (error) {
      logger.error(`Failed to get schema for table ${tableName}:`, error);
      throw error;
    }
  }

  private async getMySQLTables(poolName: string): Promise<TableInfo[]> {
    const sql = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;
    
    const tables = await databasePool.executeQuery(poolName, sql, [], 'mysql');
    const tableInfos: TableInfo[] = [];

    for (const table of tables) {
      const schema = await this.getMySQLTableSchema(poolName, table.TABLE_NAME);
      tableInfos.push(schema);
    }

    return tableInfos;
  }

  private async getMySQLTableSchema(poolName: string, tableName: string): Promise<TableInfo> {
    const sql = `
      SELECT 
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE as nullable,
        COLUMN_KEY as columnKey,
        EXTRA as extra,
        COLUMN_DEFAULT as defaultValue,
        CHARACTER_MAXIMUM_LENGTH as maxLength
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;

    const columns = await databasePool.executeQuery(poolName, sql, [tableName], 'mysql');

    return {
      name: tableName,
      columns: columns.map((col: any) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable === 'YES',
        isPrimaryKey: col.columnKey === 'PRI',
        isAutoIncrement: col.extra && col.extra.includes('auto_increment'),
        defaultValue: col.defaultValue,
        maxLength: col.maxLength
      }))
    };
  }

  private async getPostgreSQLTables(poolName: string): Promise<TableInfo[]> {
    const sql = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const tables = await databasePool.executeQuery(poolName, sql, [], 'postgresql');
    const tableInfos: TableInfo[] = [];

    for (const table of tables) {
      const schema = await this.getPostgreSQLTableSchema(poolName, table.table_name);
      tableInfos.push(schema);
    }

    return tableInfos;
  }

  private async getPostgreSQLTableSchema(poolName: string, tableName: string): Promise<TableInfo> {
    const sql = `
      SELECT 
        column_name as name,
        data_type as type,
        is_nullable as nullable,
        column_default as defaultValue,
        character_maximum_length as maxLength
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = ?
      ORDER BY ordinal_position
    `;

    const columns = await databasePool.executeQuery(poolName, sql, [tableName], 'postgresql');

    const primaryKeySql = `
      SELECT a.attname as name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass
      AND i.indisprimary
    `;

    const primaryKeys = await databasePool.executeQuery(poolName, primaryKeySql, [tableName], 'postgresql');
    const primaryKeySet = new Set(primaryKeys.map((pk: any) => pk.name));

    return {
      name: tableName,
      columns: columns.map((col: any) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable === 'YES',
        isPrimaryKey: primaryKeySet.has(col.name),
        isAutoIncrement: col.defaultValue && col.defaultValue.includes('nextval'),
        defaultValue: col.defaultValue,
        maxLength: col.maxLength
      }))
    };
  }

  private async getMSSQLTables(poolName: string): Promise<TableInfo[]> {
    const sql = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;
    
    const tables = await databasePool.executeQuery(poolName, sql, [], 'mssql');
    const tableInfos: TableInfo[] = [];

    for (const table of tables) {
      const schema = await this.getMSSQLTableSchema(poolName, table.TABLE_NAME);
      tableInfos.push(schema);
    }

    return tableInfos;
  }

  private async getMSSQLTableSchema(poolName: string, tableName: string): Promise<TableInfo> {
    const sql = `
      SELECT 
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE as nullable,
        COLUMN_DEFAULT as defaultValue,
        CHARACTER_MAXIMUM_LENGTH as maxLength
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;

    const columns = await databasePool.executeQuery(poolName, sql, [tableName], 'mssql');

    const primaryKeySql = `
      SELECT c.COLUMN_NAME as name
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS pk
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE c 
        ON c.TABLE_NAME = pk.TABLE_NAME 
        AND c.CONSTRAINT_NAME = pk.CONSTRAINT_NAME
      WHERE pk.CONSTRAINT_TYPE = 'PRIMARY KEY'
      AND pk.TABLE_NAME = ?
    `;

    const primaryKeys = await databasePool.executeQuery(poolName, primaryKeySql, [tableName], 'mssql');
    const primaryKeySet = new Set(primaryKeys.map((pk: any) => pk.name));

    return {
      name: tableName,
      columns: columns.map((col: any) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable === 'YES',
        isPrimaryKey: primaryKeySet.has(col.name),
        isAutoIncrement: col.defaultValue && col.defaultValue.includes('IDENTITY'),
        defaultValue: col.defaultValue,
        maxLength: col.maxLength
      }))
    };
  }

  private async getOracleTables(poolName: string): Promise<TableInfo[]> {
    const sql = `
      SELECT table_name 
      FROM user_tables 
      ORDER BY table_name
    `;
    
    const tables = await databasePool.executeQuery(poolName, sql, [], 'oracle');
    const tableInfos: TableInfo[] = [];

    for (const table of tables) {
      const schema = await this.getOracleTableSchema(poolName, table.TABLE_NAME);
      tableInfos.push(schema);
    }

    return tableInfos;
  }

  private async getOracleTableSchema(poolName: string, tableName: string): Promise<TableInfo> {
    const sql = `
      SELECT 
        column_name as name,
        data_type as type,
        nullable,
        data_default as defaultValue,
        char_length as maxLength
      FROM user_tab_columns
      WHERE table_name = UPPER(?)
      ORDER BY column_id
    `;

    const columns = await databasePool.executeQuery(poolName, sql, [tableName], 'oracle');

    const primaryKeySql = `
      SELECT cols.column_name as name
      FROM user_constraints cons
      JOIN user_cons_columns cols 
        ON cons.constraint_name = cols.constraint_name
      WHERE cons.constraint_type = 'P'
      AND cons.table_name = UPPER(?)
    `;

    const primaryKeys = await databasePool.executeQuery(poolName, primaryKeySql, [tableName], 'oracle');
    const primaryKeySet = new Set(primaryKeys.map((pk: any) => pk.NAME));

    return {
      name: tableName,
      columns: columns.map((col: any) => ({
        name: col.NAME,
        type: col.TYPE,
        nullable: col.NULLABLE === 'Y',
        isPrimaryKey: primaryKeySet.has(col.NAME),
        isAutoIncrement: false,
        defaultValue: col.DEFAULT_VALUE,
        maxLength: col.MAXLENGTH
      }))
    };
  }

  mapColumnTypeToJoi(columnType: string): string {
    const type = columnType.toLowerCase();
    
    if (type.includes('int') || type.includes('serial')) {
      return 'number';
    } else if (type.includes('decimal') || type.includes('numeric') || type.includes('float') || type.includes('double')) {
      return 'number';
    } else if (type.includes('bool')) {
      return 'boolean';
    } else if (type.includes('date') || type.includes('time')) {
      return 'date';
    } else if (type.includes('char') || type.includes('text') || type.includes('varchar')) {
      return 'string';
    } else if (type.includes('json') || type.includes('blob')) {
      return 'object';
    }
    
    return 'string';
  }

  generateValidationRules(columns: ColumnInfo[]): any {
    const rules: any = {};

    for (const col of columns) {
      if (col.isPrimaryKey && col.isAutoIncrement) {
        continue;
      }

      const joiType = this.mapColumnTypeToJoi(col.type);
      rules[col.name] = {
        type: joiType,
        required: !col.nullable
      };

      if (col.maxLength && joiType === 'string') {
        rules[col.name].maxLength = col.maxLength;
      }
    }

    return rules;
  }
}

export const schemaIntrospector = new SchemaIntrospector();
