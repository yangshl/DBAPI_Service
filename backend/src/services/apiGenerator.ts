import { schemaIntrospector, ColumnInfo, TableInfo } from './schemaIntrospector';
import { logger } from '../utils/logger';

export interface GeneratedAPI {
  name: string;
  path: string;
  method: string;
  description: string;
  sql_template: string;
  parameters: GeneratedParameter[];
  validation_rules: any;
}

export interface GeneratedParameter {
  param_name: string;
  param_type: string;
  data_type: string;
  required: number;
  default_value?: string;
  validation_rule?: string;
  description?: string;
}

export interface GeneratedAPIs {
  get: GeneratedAPI;
  post?: GeneratedAPI;
  put?: GeneratedAPI;
  delete?: GeneratedAPI;
}

class APIGenerator {
  generateAPIsFromTable(tableInfo: TableInfo, apiName?: string, apiPath?: string): GeneratedAPIs {
    const tableName = tableInfo.name;
    const columns = tableInfo.columns;
    const primaryKey = columns.find(col => col.isPrimaryKey);

    const name = apiName || this.formatTableNameToAPIName(tableName);
    const path = apiPath || `/api/${this.formatTableNameToPath(tableName)}`;

    const generated: GeneratedAPIs = {
      get: this.generateGetAPI(name, path, tableName, columns),
      post: this.generatePostAPI(name, path, tableName, columns),
      put: this.generatePutAPI(name, path, tableName, columns, primaryKey),
      delete: this.generateDeleteAPI(name, path, tableName, primaryKey)
    };

    return generated;
  }

  private formatTableNameToAPIName(tableName: string): string {
    return tableName
      .split(/[_\s-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private formatTableNameToPath(tableName: string): string {
    return tableName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');
  }

  private generateGetAPI(name: string, path: string, tableName: string, columns: ColumnInfo[]): GeneratedAPI {
    const primaryKey = columns.find(col => col.isPrimaryKey);
    const columnList = columns.map(col => col.name).join(', ');

    let sqlTemplate: string;
    let parameters: GeneratedParameter[];
    let description: string;
    let apiPath: string;

    if (primaryKey) {
      apiPath = `${path}/:id`;
      sqlTemplate = `SELECT ${columnList} FROM ${tableName} WHERE ${primaryKey.name} = {{id}}`;
      parameters = [
        {
          param_name: 'id',
          param_type: 'path',
          data_type: schemaIntrospector.mapColumnTypeToJoi(primaryKey.type),
          required: 1,
          description: `${primaryKey.name} of the record`
        }
      ];
      description = `Get a single ${name} by ${primaryKey.name}`;
    } else {
      apiPath = path;
      sqlTemplate = `SELECT ${columnList} FROM ${tableName}`;
      parameters = [
        {
          param_name: 'limit',
          param_type: 'query',
          data_type: 'number',
          required: 0,
          default_value: '100',
          description: 'Maximum number of records to return'
        },
        {
          param_name: 'offset',
          param_type: 'query',
          data_type: 'number',
          required: 0,
          default_value: '0',
          description: 'Number of records to skip'
        }
      ];
      description = `Get all ${name} records`;
    }

    return {
      name: `Get ${name}`,
      path: apiPath,
      method: 'GET',
      description,
      sql_template: sqlTemplate,
      parameters,
      validation_rules: schemaIntrospector.generateValidationRules(columns)
    };
  }

  private generatePostAPI(name: string, path: string, tableName: string, columns: ColumnInfo[]): GeneratedAPI {
    const insertColumns = columns.filter(col => !col.isAutoIncrement);
    const columnNames = insertColumns.map(col => col.name).join(', ');
    const placeholders = insertColumns.map(col => `{{${col.name}}}`).join(', ');

    const parameters: GeneratedParameter[] = insertColumns.map(col => ({
      param_name: col.name,
      param_type: 'body',
      data_type: schemaIntrospector.mapColumnTypeToJoi(col.type),
      required: col.nullable ? 0 : 1,
      default_value: col.defaultValue,
      description: `${col.name} field`
    }));

    const sqlTemplate = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`;

    return {
      name: `Create ${name}`,
      path: path,
      method: 'POST',
      description: `Create a new ${name} record`,
      sql_template: sqlTemplate,
      parameters,
      validation_rules: schemaIntrospector.generateValidationRules(insertColumns)
    };
  }

  private generatePutAPI(name: string, path: string, tableName: string, columns: ColumnInfo[], primaryKey?: ColumnInfo): GeneratedAPI | undefined {
    if (!primaryKey) {
      logger.warn(`Cannot generate PUT API for ${tableName}: no primary key found`);
      return undefined;
    }

    const updateColumns = columns.filter(col => !col.isPrimaryKey && !col.isAutoIncrement);
    const setClause = updateColumns.map(col => `${col.name} = {{${col.name}}}`).join(', ');

    const parameters: GeneratedParameter[] = [
      {
        param_name: primaryKey.name,
        param_type: 'path',
        data_type: schemaIntrospector.mapColumnTypeToJoi(primaryKey.type),
        required: 1,
        description: `${primaryKey.name} of the record to update`
      },
      ...updateColumns.map(col => ({
        param_name: col.name,
        param_type: 'body',
        data_type: schemaIntrospector.mapColumnTypeToJoi(col.type),
        required: 0,
        default_value: col.defaultValue,
        description: `${col.name} field to update`
      }))
    ];

    const sqlTemplate = `UPDATE ${tableName} SET ${setClause} WHERE ${primaryKey.name} = {{${primaryKey.name}}}`;

    return {
      name: `Update ${name}`,
      path: `${path}/:id`,
      method: 'PUT',
      description: `Update a ${name} record by ${primaryKey.name}`,
      sql_template: sqlTemplate,
      parameters,
      validation_rules: schemaIntrospector.generateValidationRules(updateColumns)
    };
  }

  private generateDeleteAPI(name: string, path: string, tableName: string, primaryKey?: ColumnInfo): GeneratedAPI | undefined {
    if (!primaryKey) {
      logger.warn(`Cannot generate DELETE API for ${tableName}: no primary key found`);
      return undefined;
    }

    const parameters: GeneratedParameter[] = [
      {
        param_name: primaryKey.name,
        param_type: 'path',
        data_type: schemaIntrospector.mapColumnTypeToJoi(primaryKey.type),
        required: 1,
        description: `${primaryKey.name} of the record to delete`
      }
    ];

    const sqlTemplate = `DELETE FROM ${tableName} WHERE ${primaryKey.name} = {{${primaryKey.name}}}`;

    return {
      name: `Delete ${name}`,
      path: `${path}/:id`,
      method: 'DELETE',
      description: `Delete a ${name} record by ${primaryKey.name}`,
      sql_template: sqlTemplate,
      parameters,
      validation_rules: {}
    };
  }

  generateBulkGetAPI(name: string, path: string, tableName: string, columns: ColumnInfo[]): GeneratedAPI {
    const columnList = columns.map(col => col.name).join(', ');
    const primaryKey = columns.find(col => col.isPrimaryKey);

    const parameters: GeneratedParameter[] = [
      {
        param_name: 'limit',
        param_type: 'query',
        data_type: 'number',
        required: 0,
        default_value: '100',
        description: 'Maximum number of records to return'
      },
      {
        param_name: 'offset',
        param_type: 'query',
        data_type: 'number',
        required: 0,
        default_value: '0',
        description: 'Number of records to skip'
      },
      {
        param_name: 'order_by',
        param_type: 'query',
        data_type: 'string',
        required: 0,
        default_value: primaryKey ? primaryKey.name : 'id',
        description: 'Column to order by'
      },
      {
        param_name: 'order',
        param_type: 'query',
        data_type: 'string',
        required: 0,
        default_value: 'ASC',
        description: 'Sort order (ASC or DESC)'
      }
    ];

    const sqlTemplate = `SELECT ${columnList} FROM ${tableName} ORDER BY {{order_by}} {{order}} LIMIT {{limit}} OFFSET {{offset}}`;

    return {
      name: `Get All ${name}`,
      path: path,
      method: 'GET',
      description: `Get all ${name} records with pagination and sorting`,
      sql_template: sqlTemplate,
      parameters,
      validation_rules: {}
    };
  }

  generateSearchAPI(name: string, path: string, tableName: string, columns: ColumnInfo[]): GeneratedAPI {
    const columnList = columns.map(col => col.name).join(', ');
    const searchableColumns = columns.filter(col => 
      col.type.toLowerCase().includes('char') || 
      col.type.toLowerCase().includes('text') ||
      col.type.toLowerCase().includes('varchar')
    );

    const searchConditions = searchableColumns.map(col => `${col.name} LIKE {{search}}`).join(' OR ');

    const parameters: GeneratedParameter[] = [
      {
        param_name: 'search',
        param_type: 'query',
        data_type: 'string',
        required: 1,
        description: 'Search term'
      },
      {
        param_name: 'limit',
        param_type: 'query',
        data_type: 'number',
        required: 0,
        default_value: '100',
        description: 'Maximum number of records to return'
      }
    ];

    const sqlTemplate = `SELECT ${columnList} FROM ${tableName} WHERE ${searchConditions} LIMIT {{limit}}`;

    return {
      name: `Search ${name}`,
      path: `${path}/search`,
      method: 'GET',
      description: `Search ${name} records by text fields`,
      sql_template: sqlTemplate,
      parameters,
      validation_rules: {}
    };
  }

  generateCountAPI(name: string, path: string, tableName: string): GeneratedAPI {
    const sqlTemplate = `SELECT COUNT(*) as total FROM ${tableName}`;

    return {
      name: `Count ${name}`,
      path: `${path}/count`,
      method: 'GET',
      description: `Get the total count of ${name} records`,
      sql_template: sqlTemplate,
      parameters: [],
      validation_rules: {}
    };
  }

  generateFullCRUDAPIs(tableInfo: TableInfo, apiName?: string, apiPath?: string): GeneratedAPI[] {
    const basicAPIs = this.generateAPIsFromTable(tableInfo, apiName, apiPath);
    const apis: GeneratedAPI[] = [];

    apis.push(basicAPIs.get);
    
    if (basicAPIs.post) apis.push(basicAPIs.post);
    if (basicAPIs.put) apis.push(basicAPIs.put);
    if (basicAPIs.delete) apis.push(basicAPIs.delete);

    const name = apiName || this.formatTableNameToAPIName(tableInfo.name);
    const path = apiPath || `/api/${this.formatTableNameToPath(tableInfo.name)}`;

    apis.push(this.generateBulkGetAPI(name, path, tableInfo.name, tableInfo.columns));
    apis.push(this.generateSearchAPI(name, path, tableInfo.name, tableInfo.columns));
    apis.push(this.generateCountAPI(name, path, tableInfo.name));

    return apis;
  }
}

export const apiGenerator = new APIGenerator();
