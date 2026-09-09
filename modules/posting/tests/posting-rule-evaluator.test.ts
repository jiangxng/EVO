import { describe, expect, it } from 'vitest';
import { evaluatePostingRules } from '../domain/posting-rule-evaluator.js';

describe('evaluatePostingRules', () => {
  it('creates deterministic ledger effects from metadata AST', () => {
    const effects = evaluatePostingRules(
      {
        productId: 'P-1',
        productType: 'SELF_MADE',
        quantity: 20,
        amount: '300.00',
        currency: 'USD'
      },
      [
        {
          id: 'rule-1',
          code: 'pending-shipment',
          priority: 10,
          ruleSchemaVersion: 1,
          conditionAst: {
            type: 'eq',
            left: { type: 'field', path: 'productType' },
            right: { type: 'literal', value: 'SELF_MADE' }
          },
          effectAst: {
            ledgerCode: 'pending_shipment',
            quantity: { type: 'field', path: 'quantity' },
            amount: { type: 'field', path: 'amount' },
            currency: { type: 'field', path: 'currency' },
            dimensions: {
              product_id: { type: 'field', path: 'productId' }
            }
          }
        }
      ]
    );

    expect(effects).toEqual([
      {
        postingRuleId: 'rule-1',
        postingRuleCode: 'pending-shipment',
        postingRuleSchemaVersion: 1,
        effectIndex: 0,
        ledgerCode: 'pending_shipment',
        quantity: '20',
        amount: '300.00',
        unit: null,
        currency: 'USD',
        dimensions: {
          product_id: 'P-1'
        }
      }
    ]);
  });
});
