import Joi from 'joi';
import { logger } from '../utils/logger';
import { query } from '../config/database';

export interface APIParameter {
  id?: number;
  api_id: number;
  param_name: string;
  param_type: 'path' | 'query' | 'body';
  data_type: string;
  required: number;
  default_value?: string;
  validation_rule?: string;
  description?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: Record<string, string>;
}

class ValidationService {
  async getAPIParameters(apiId: number): Promise<APIParameter[]> {
    try {
      const parameters = await query(
        'SELECT * FROM api_parameters WHERE api_id = ? ORDER BY id',
        [apiId]
      );
      return parameters as APIParameter[];
    } catch (error) {
      logger.error(`Failed to get parameters for API ${apiId}:`, error);
      return [];
    }
  }

  buildJoiSchema(parameters: APIParameter[]): Joi.ObjectSchema {
    const schemaObj: Record<string, Joi.Schema> = {};

    for (const param of parameters) {
      let joiType: Joi.Schema;

      switch (param.data_type.toLowerCase()) {
        case 'number':
          joiType = Joi.number();
          break;
        case 'boolean':
          joiType = Joi.boolean();
          break;
        case 'date':
          joiType = Joi.date();
          break;
        case 'object':
          joiType = Joi.object();
          break;
        case 'array':
          joiType = Joi.array();
          break;
        default:
          joiType = Joi.string();
      }

      if (param.required === 1) {
        joiType = joiType.required();
      } else {
        joiType = joiType.optional();
      }

      if (param.default_value) {
        try {
          const parsedDefault = JSON.parse(param.default_value);
          joiType = joiType.default(parsedDefault);
        } catch {
          joiType = joiType.default(param.default_value);
        }
      }

      if (param.validation_rule) {
        try {
          const customRule = this.parseValidationRule(param.validation_rule);
          if (customRule.min !== undefined) {
            joiType = (joiType as any).min(customRule.min);
          }
          if (customRule.max !== undefined) {
            joiType = (joiType as any).max(customRule.max);
          }
          if (customRule.pattern) {
            joiType = (joiType as any).pattern(new RegExp(customRule.pattern));
          }
          if (customRule.enum) {
            joiType = (joiType as any).valid(...customRule.enum);
          }
          if (customRule.email) {
            joiType = (joiType as any).email();
          }
          if (customRule.uri) {
            joiType = (joiType as any).uri();
          }
        } catch (error) {
          logger.warn(`Failed to parse validation rule for ${param.param_name}:`, error);
        }
      }

      schemaObj[param.param_name] = joiType;
    }

    return Joi.object(schemaObj);
  }

  parseValidationRule(rule: string): any {
    try {
      return JSON.parse(rule);
    } catch {
      return {};
    }
  }

  async validateRequest(apiId: number, params: Record<string, any>): Promise<ValidationResult> {
    try {
      const parameters = await this.getAPIParameters(apiId);

      if (parameters.length === 0) {
        return { valid: true };
      }

      const schema = this.buildJoiSchema(parameters);

      const { error, value } = schema.validate(params, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errors: Record<string, string> = {};
        for (const detail of error.details) {
          errors[detail.path.join('.')] = detail.message;
        }
        return { valid: false, errors };
      }

      return { valid: true };
    } catch (error) {
      logger.error(`Validation error for API ${apiId}:`, error);
      return {
        valid: false,
        errors: { _general: 'Validation failed' }
      };
    }
  }

  validateSQLParams(sql: string, params: Record<string, any>): ValidationResult {
    const placeholders = sql.match(/\{\{(\w+)\}\}/g) || [];
    const requiredParams = new Set(
      placeholders.map(p => p.replace(/\{\{|\}\}/g, ''))
    );

    const missingParams: string[] = [];
    for (const param of requiredParams) {
      if (!(param in params) || params[param] === undefined || params[param] === null) {
        missingParams.push(param);
      }
    }

    if (missingParams.length > 0) {
      return {
        valid: false,
        errors: {
          _sql: `Missing required SQL parameters: ${missingParams.join(', ')}`
        }
      };
    }

    return { valid: true };
  }

  sanitizeInput(value: any): any {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  }

  async validateAndSanitizeRequest(apiId: number, params: Record<string, any>): Promise<{
    valid: boolean;
    sanitizedParams?: Record<string, any>;
    errors?: Record<string, string>;
  }> {
    const sanitizedParams: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      sanitizedParams[key] = this.sanitizeInput(value);
    }

    const validationResult = await this.validateRequest(apiId, sanitizedParams);

    if (!validationResult.valid) {
      return validationResult;
    }

    return { valid: true, sanitizedParams };
  }
}

export const validationService = new ValidationService();
