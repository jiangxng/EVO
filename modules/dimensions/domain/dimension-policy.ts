import { AppError } from '../../../platform/contracts/src/index.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type { LedgerDimensionPolicy } from '../api/contracts.js';

export function validateDimensionPolicy(
  ledgerCode: string,
  policy: LedgerDimensionPolicy,
  dimensions: JsonObject,
  knownDimensionCodes: ReadonlySet<string>
): void {
  const required = new Set(policy.required ?? []);
  const optional = new Set(policy.optional ?? []);
  const forbidden = new Set(policy.forbidden ?? []);
  const declared = new Set([...required, ...optional]);

  for (const code of required) {
    const value = dimensions[code];
    if (value === undefined || value === null || value === '') {
      throw new AppError({
        code: 'LEDGER_DIMENSION_REQUIRED',
        message: `Ledger ${ledgerCode} requires dimension ${code}.`,
        module: 'dimensions',
        operation: 'validateDimensionPolicy',
        details: { ledgerCode, dimensionCode: code }
      });
    }
  }

  for (const code of Object.keys(dimensions)) {
    if (!knownDimensionCodes.has(code)) {
      throw new AppError({
        code: 'DIMENSION_DEFINITION_NOT_FOUND',
        message: `Dimension ${code} is not published for this enterprise.`,
        module: 'dimensions',
        operation: 'validateDimensionPolicy',
        details: { ledgerCode, dimensionCode: code }
      });
    }
    if (forbidden.has(code) || (declared.size > 0 && !declared.has(code))) {
      throw new AppError({
        code: 'LEDGER_DIMENSION_NOT_ALLOWED',
        message: `Dimension ${code} is not allowed on ledger ${ledgerCode}.`,
        module: 'dimensions',
        operation: 'validateDimensionPolicy',
        details: { ledgerCode, dimensionCode: code }
      });
    }
  }
}
