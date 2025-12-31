export interface ExtractedParameter {
  param_name: string;
  param_type: 'path' | 'query' | 'body';
  data_type: 'string' | 'number' | 'boolean' | 'date';
  required: number;
  default_value?: string;
  validation_rule?: string;
  description?: string;
}

export class SQLParameterExtractor {
  extractParameters(sqlTemplate: string): ExtractedParameter[] {
    if (!sqlTemplate || typeof sqlTemplate !== 'string') {
      return [];
    }

    const regex = /\{\{(\w+)\}\}/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(sqlTemplate)) !== null) {
      const paramName = match[1];
      if (!matches.includes(paramName)) {
        matches.push(paramName);
      }
    }

    return matches.map(paramName => this.inferParameter(paramName, sqlTemplate));
  }

  private inferParameter(paramName: string, sqlTemplate: string): ExtractedParameter {
    const paramType = this.inferParamType(paramName, sqlTemplate);
    const dataType = this.inferDataType(paramName, sqlTemplate);
    const required = this.inferRequired(paramName, sqlTemplate);
    const description = this.generateDescription(paramName);

    return {
      param_name: paramName,
      param_type: paramType,
      data_type: dataType,
      required: required ? 1 : 0,
      description
    };
  }

  private inferParamType(paramName: string, sqlTemplate: string): 'path' | 'query' | 'body' {
    const commonPathParams = ['id', 'uuid', 'pk', 'primary_key'];
    const commonQueryParams = ['limit', 'offset', 'order_by', 'order', 'sort', 'search', 'page', 'size', 'filter', 'start_date', 'end_date', 'from', 'to'];
    
    const lowerParamName = paramName.toLowerCase();

    if (commonPathParams.some(p => lowerParamName === p || lowerParamName.endsWith('_' + p))) {
      return 'path';
    }

    if (commonQueryParams.some(p => lowerParamName === p || lowerParamName.endsWith('_' + p))) {
      return 'query';
    }

    if (sqlTemplate.toLowerCase().includes('insert') || sqlTemplate.toLowerCase().includes('update')) {
      return 'body';
    }

    return 'query';
  }

  private inferDataType(paramName: string, sqlTemplate: string): 'string' | 'number' | 'boolean' | 'date' {
    const lowerParamName = paramName.toLowerCase();

    const numberPatterns = [
      /id$/, /_id$/, /count$/, /total$/, /sum$/, /avg$/, /max$/, /min$/,
      /limit$/, /offset$/, /page$/, /size$/, /amount$/, /price$/, /quantity$/,
      /age$/, /score$/, /rate$/, /percent$/, /ratio$/
    ];

    const booleanPatterns = [
      /is_/, /has_/, /enabled$/, /disabled$/, /active$/, /inactive$/,
      /deleted$/, /verified$/, /approved$/, /rejected$/, /published$/,
      /visible$/, /hidden$/, /locked$/, /unlocked$/
    ];

    const datePatterns = [
      /date$/, /time$/, /_at$/, /_on$/, /created$/, /updated$/, /deleted$/,
      /start$/, /end$/, /from$/, /to$/, /begin$/, /expire$/, /due$/,
      /birthday$/, /birth_date$/, /join_date$/, /register_date$/
    ];

    if (numberPatterns.some(pattern => pattern.test(lowerParamName))) {
      return 'number';
    }

    if (booleanPatterns.some(pattern => pattern.test(lowerParamName))) {
      return 'boolean';
    }

    if (datePatterns.some(pattern => pattern.test(lowerParamName))) {
      return 'date';
    }

    return 'string';
  }

  private inferRequired(paramName: string, sqlTemplate: string): boolean {
    const lowerParamName = paramName.toLowerCase();
    const commonOptionalParams = ['limit', 'offset', 'order_by', 'order', 'search', 'page', 'size', 'filter'];

    if (commonOptionalParams.includes(lowerParamName)) {
      return false;
    }

    if (lowerParamName.startsWith('optional_')) {
      return false;
    }

    if (lowerParamName.endsWith('_optional')) {
      return false;
    }

    return true;
  }

  private generateDescription(paramName: string): string {
    const lowerParamName = paramName.toLowerCase();

    const descriptions: Record<string, string> = {
      'id': 'Record identifier',
      'limit': 'Maximum number of records to return',
      'offset': 'Number of records to skip',
      'order_by': 'Column to order by',
      'order': 'Sort order (ASC or DESC)',
      'search': 'Search term for filtering',
      'page': 'Page number',
      'size': 'Page size',
      'start_date': 'Start date for filtering',
      'end_date': 'End date for filtering',
      'status': 'Record status',
      'name': 'Name',
      'email': 'Email address',
      'username': 'Username',
      'password': 'Password',
      'created_at': 'Creation timestamp',
      'updated_at': 'Last update timestamp',
      'deleted_at': 'Deletion timestamp'
    };

    if (descriptions[lowerParamName]) {
      return descriptions[lowerParamName];
    }

    return `${paramName} parameter`;
  }

  extractParametersWithDefaults(
    sqlTemplate: string,
    existingParameters: ExtractedParameter[] = []
  ): ExtractedParameter[] {
    const extracted = this.extractParameters(sqlTemplate);
    const existingMap = new Map(
      existingParameters.map(p => [p.param_name, p])
    );

    return extracted.map(param => {
      const existing = existingMap.get(param.param_name);
      if (existing) {
        return {
          ...param,
          param_type: existing.param_type,
          data_type: existing.data_type,
          required: existing.required,
          default_value: existing.default_value,
          validation_rule: existing.validation_rule,
          description: existing.description || param.description
        };
      }
      return param;
    });
  }
}

export const sqlParameterExtractor = new SQLParameterExtractor();
