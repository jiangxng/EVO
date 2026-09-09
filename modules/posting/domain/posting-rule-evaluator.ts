import { AppError } from '../../../platform/contracts/src/index.js';
import type { LedgerEffect } from '../../ledger/api/contracts.js';
import type {
  JsonObject,
  JsonValue,
  PostingRuleDefinition
} from '../../metadata/api/contracts.js';
import {
  evaluateBoolean,
  evaluateExpression
} from './expression-engine.js';

function objectValue(value: JsonValue, field: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError({
      code: 'INVALID_POSTING_EFFECT',
      message: `${field} must be an object.`,
      module: 'posting',
      operation: 'evaluatePostingRules'
    });
  }
  return value as JsonObject;
}

function scalarString(value: JsonValue, field: string): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }

  throw new AppError({
    code: 'INVALID_POSTING_EFFECT',
    message: `${field} must evaluate to a string, safe integer or null.`,
    module: 'posting',
    operation: 'evaluatePostingRules'
  });
}

function evaluateDimensions(
  raw: JsonObject,
  payload: JsonObject
): JsonObject {
  const result: Record<string, JsonValue> = {};

  for (const [key, expression] of Object.entries(raw)) {
    result[key] = evaluateExpression(expression, { payload });
  }

  return result;
}

export function evaluatePostingRules(
  payload: JsonObject,
  rules: readonly PostingRuleDefinition[]
): readonly LedgerEffect[] {
  const effects: LedgerEffect[] = [];

  for (const rule of rules) {
    if (!evaluateBoolean(rule.conditionAst, { payload })) continue;

    const effect = rule.effectAst;
    const ledgerCode = effect.ledgerCode;

    if (typeof ledgerCode !== 'string' || ledgerCode.length === 0) {
      throw new AppError({
        code: 'INVALID_POSTING_EFFECT',
        message: 'Posting effect ledgerCode is required.',
        module: 'posting',
        operation: 'evaluatePostingRules',
        details: { postingRuleId: rule.id, postingRuleCode: rule.code }
      });
    }

    const dimensionsRaw =
      effect.dimensions === undefined
        ? {}
        : objectValue(effect.dimensions, 'dimensions');

    const quantity =
      effect.quantity === undefined
        ? null
        : scalarString(
            evaluateExpression(effect.quantity, { payload }),
            'quantity'
          );

    const amount =
      effect.amount === undefined
        ? null
        : scalarString(
            evaluateExpression(effect.amount, { payload }),
            'amount'
          );

    const unit =
      effect.unit === undefined
        ? null
        : scalarString(
            evaluateExpression(effect.unit, { payload }),
            'unit'
          );

    const currency =
      effect.currency === undefined
        ? null
        : scalarString(
            evaluateExpression(effect.currency, { payload }),
            'currency'
          );

    effects.push({
      postingRuleId: rule.id,
      postingRuleCode: rule.code,
      postingRuleSchemaVersion: rule.ruleSchemaVersion,
      effectIndex: 0,
      ledgerCode,
      quantity,
      amount,
      unit,
      currency,
      dimensions: evaluateDimensions(dimensionsRaw, payload)
    });
  }

  return effects;
}
