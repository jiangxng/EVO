import { Decimal } from 'decimal.js';
import { AppError } from '../../../platform/contracts/src/index.js';
import type {
  JsonObject,
  JsonValue
} from '../../metadata/api/contracts.js';

export interface ExpressionContext {
  readonly payload: JsonObject;
}

type ExpressionObject = Readonly<Record<string, JsonValue>>;

function expressionObject(value: JsonValue): ExpressionObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidExpression('Expression must be an object.');
  }
  return value as ExpressionObject;
}

function invalidExpression(message: string): AppError {
  return new AppError({
    code: 'INVALID_POSTING_EXPRESSION',
    message,
    module: 'posting',
    operation: 'evaluateExpression'
  });
}

function fieldValue(payload: JsonObject, path: string): JsonValue {
  const segments = path.split('.').filter(Boolean);
  let current: JsonValue = payload;

  for (const segment of segments) {
    if (
      typeof current !== 'object' ||
      current === null ||
      Array.isArray(current)
    ) return null;

    current = (current as JsonObject)[segment] ?? null;
  }

  return current;
}

function decimal(value: JsonValue): Decimal {
  if (typeof value === 'string') return new Decimal(value);

  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return new Decimal(value);
  }

  throw invalidExpression(
    'Authoritative numeric expressions require decimal strings or safe integers.'
  );
}

function compare(left: JsonValue, right: JsonValue): number {
  if (
    (typeof left === 'string' || typeof left === 'number') &&
    (typeof right === 'string' || typeof right === 'number')
  ) {
    try {
      return decimal(left).cmp(decimal(right));
    } catch {
      // Fall back to scalar comparison below for non-numeric strings.
    }
  }

  if (left === right) return 0;
  return String(left) < String(right) ? -1 : 1;
}

export function evaluateExpression(
  raw: JsonValue,
  context: ExpressionContext
): JsonValue {
  const expr = expressionObject(raw);
  const type = expr.type;

  if (typeof type !== 'string') {
    throw invalidExpression('Expression type is required.');
  }

  switch (type) {
    case 'literal':
      return expr.value ?? null;

    case 'field': {
      const path = expr.path;
      if (typeof path !== 'string') {
        throw invalidExpression('Field expression path must be a string.');
      }
      return fieldValue(context.payload, path);
    }

    case 'not':
      return !evaluateBoolean(expr.value ?? null, context);

    case 'and': {
      const values = expr.values;
      if (!Array.isArray(values)) {
        throw invalidExpression('and.values must be an array.');
      }
      return values.every((value) => evaluateBoolean(value, context));
    }

    case 'or': {
      const values = expr.values;
      if (!Array.isArray(values)) {
        throw invalidExpression('or.values must be an array.');
      }
      return values.some((value) => evaluateBoolean(value, context));
    }

    case 'eq':
    case 'ne':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const left = evaluateExpression(expr.left ?? null, context);
      const right = evaluateExpression(expr.right ?? null, context);
      const c = compare(left, right);
      if (type === 'eq') return c === 0;
      if (type === 'ne') return c !== 0;
      if (type === 'gt') return c > 0;
      if (type === 'gte') return c >= 0;
      if (type === 'lt') return c < 0;
      return c <= 0;
    }

    case 'add':
    case 'sub':
    case 'mul':
    case 'div': {
      const left = decimal(
        evaluateExpression(expr.left ?? null, context)
      );
      const right = decimal(
        evaluateExpression(expr.right ?? null, context)
      );

      if (type === 'add') return left.plus(right).toString();
      if (type === 'sub') return left.minus(right).toString();
      if (type === 'mul') return left.times(right).toString();

      if (right.isZero()) {
        throw invalidExpression('Division by zero.');
      }
      return left.div(right).toString();
    }

    default:
      throw invalidExpression(`Unsupported expression type: ${type}`);
  }
}

export function evaluateBoolean(
  raw: JsonValue,
  context: ExpressionContext
): boolean {
  const value = evaluateExpression(raw, context);
  if (typeof value !== 'boolean') {
    throw invalidExpression('Condition expression must evaluate to boolean.');
  }
  return value;
}
