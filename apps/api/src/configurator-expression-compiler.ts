import { createHash } from 'node:crypto';
import type { JsonObject, JsonValue } from '../../../modules/metadata/api/contracts.js';
import type { ConfiguratorBurnBody } from './configurator-mvp.js';

type Token =
  | { readonly type: 'string' | 'number' | 'identifier' | 'operator'; readonly value: string }
  | { readonly type: 'eof'; readonly value: '' };

export interface BookkeepingApplicationSourceV010 {
  readonly id: number;
  readonly uuid: string;
  readonly title: string;
  readonly processId: number | null;
  readonly voucherType: string | null;
  readonly iotcs: string | null;
  readonly state: string | null;
  readonly modified: string | null;
}

export interface BookkeepingAccountSourceV010 {
  readonly id: number;
  readonly title: string;
  readonly isFinance: boolean;
  readonly bigClass: string | null;
  readonly subClass: string | null;
  readonly description: string | null;
  readonly objectField: string | null;
  readonly objectType: string | null;
  readonly laneFields: string | null;
}

export interface BookkeepingPolicySourceV010 {
  readonly id: number;
  readonly appId: string;
  readonly appTitle: string | null;
  readonly accountId: number;
  readonly accountTitle: string | null;
  readonly direction: string;
  readonly quantityFormula: string | null;
  readonly amountFormula: string | null;
  readonly entryConditions: string | null;
  readonly defaultValues: string | null;
  readonly objectField: string | null;
  readonly objectType: string | null;
}

export interface BookkeepingBaselineSourceV010 {
  readonly contractVersion: '0.1.0';
  readonly applications: readonly BookkeepingApplicationSourceV010[];
  readonly accounts: readonly BookkeepingAccountSourceV010[];
  readonly policies: readonly BookkeepingPolicySourceV010[];
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const identifierStart = /[A-Za-z_\p{L}]/u;
  const identifierPart = /[A-Za-z0-9_.\p{L}\p{N}]/u;

  while (index < input.length) {
    const character = input[index]!;
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }

    if (character === "'") {
      let value = '';
      index += 1;
      let closed = false;
      while (index < input.length) {
        const current = input[index]!;
        index += 1;
        if (current === '\\') {
          if (index >= input.length) {
            throw new Error('BOOKKEEPING_EXPRESSION_ESCAPE_INVALID');
          }
          value += input[index]!;
          index += 1;
          continue;
        }
        if (current === "'") {
          closed = true;
          break;
        }
        value += current;
      }
      if (!closed) throw new Error('BOOKKEEPING_EXPRESSION_STRING_UNTERMINATED');
      tokens.push({ type: 'string', value });
      continue;
    }

    if (/[0-9]/u.test(character)) {
      let end = index + 1;
      while (end < input.length && /[0-9.]/u.test(input[end]!)) end += 1;
      tokens.push({ type: 'number', value: input.slice(index, end) });
      index = end;
      continue;
    }

    if (identifierStart.test(character)) {
      let end = index + 1;
      while (end < input.length && identifierPart.test(input[end]!)) end += 1;
      tokens.push({ type: 'identifier', value: input.slice(index, end) });
      index = end;
      continue;
    }

    const pair = input.slice(index, index + 2);
    if (['&&', '||', '==', '!=', '>=', '<='].includes(pair)) {
      tokens.push({ type: 'operator', value: pair });
      index += 2;
      continue;
    }

    if (['>', '<', '+', '-', '*', '/', '?', ':', '!', '(', ')', ','].includes(character)) {
      tokens.push({ type: 'operator', value: character });
      index += 1;
      continue;
    }

    throw new Error(
      `BOOKKEEPING_EXPRESSION_TOKEN_UNSUPPORTED: '${character}' at ${index} in ${input}`
    );
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

export function compileBookkeepingExpressionV010(source: string): JsonObject {
  const input = source.trim();
  if (!input) throw new Error('BOOKKEEPING_EXPRESSION_REQUIRED');

  const tokens = tokenize(input);
  let position = 0;
  const peek = (): Token => tokens[position]!;
  const take = (): Token => tokens[position++]!;
  const match = (value: string): boolean => {
    if (peek().value !== value) return false;
    position += 1;
    return true;
  };
  const expect = (value: string): void => {
    if (!match(value)) {
      throw new Error(
        `BOOKKEEPING_EXPRESSION_EXPECTED: expected '${value}', got '${peek().value}' in ${input}`
      );
    }
  };

  const literal = (value: JsonValue): JsonObject => ({ type: 'literal', value });

  let parseConditional: () => JsonObject;

  const parsePrimary = (): JsonObject => {
    const token = peek();

    if (match('(')) {
      const expression = parseConditional();
      expect(')');
      return expression;
    }

    if (token.type === 'string') {
      take();
      return literal(token.value);
    }

    if (token.type === 'number') {
      take();
      return literal(
        token.value.includes('.') ? token.value : Number(token.value)
      );
    }

    if (token.type === 'identifier') {
      take();
      const identifier = token.value;

      if (identifier === 'true') return literal(true);
      if (identifier === 'false') return literal(false);
      if (identifier === 'null') return literal(null);

      if (match('(')) {
        const args: JsonObject[] = [];
        if (!match(')')) {
          do {
            args.push(parseConditional());
          } while (match(','));
          expect(')');
        }

        if (identifier === 'string.split') {
          if (args.length !== 2) {
            throw new Error('BOOKKEEPING_EXPRESSION_SPLIT_ARGUMENTS_INVALID');
          }
          return {
            type: 'split',
            value: args[0]!,
            separator: args[1]!
          };
        }

        if (identifier === 'include') {
          if (args.length !== 2) {
            throw new Error('BOOKKEEPING_EXPRESSION_INCLUDE_ARGUMENTS_INVALID');
          }
          return {
            type: 'contains',
            collection: args[0]!,
            value: args[1]!
          };
        }

        throw new Error(
          `BOOKKEEPING_EXPRESSION_FUNCTION_UNSUPPORTED: ${identifier}`
        );
      }

      return { type: 'field', path: identifier };
    }

    throw new Error(
      `BOOKKEEPING_EXPRESSION_PRIMARY_INVALID: ${JSON.stringify(token)} in ${input}`
    );
  };

  const parseUnary = (): JsonObject => {
    if (match('!')) return { type: 'not', value: parseUnary() };
    if (match('-')) {
      return {
        type: 'sub',
        left: literal(0),
        right: parseUnary()
      };
    }
    return parsePrimary();
  };

  const parseBinary = (
    lower: () => JsonObject,
    operators: Readonly<Record<string, string>>
  ): JsonObject => {
    let expression = lower();
    while (Object.hasOwn(operators, peek().value)) {
      const operator = take().value;
      expression = {
        type: operators[operator]!,
        left: expression,
        right: lower()
      };
    }
    return expression;
  };

  const parseMultiplicative = (): JsonObject =>
    parseBinary(parseUnary, { '*': 'mul', '/': 'div' });
  const parseAdditive = (): JsonObject =>
    parseBinary(parseMultiplicative, { '+': 'add', '-': 'sub' });
  const parseComparison = (): JsonObject =>
    parseBinary(parseAdditive, {
      '>': 'gt',
      '>=': 'gte',
      '<': 'lt',
      '<=': 'lte'
    });
  const parseEquality = (): JsonObject =>
    parseBinary(parseComparison, { '==': 'eq', '!=': 'ne' });

  const parseAnd = (): JsonObject => {
    const values = [parseEquality()];
    while (match('&&')) values.push(parseEquality());
    return values.length === 1
      ? values[0]!
      : { type: 'and', values };
  };

  const parseOr = (): JsonObject => {
    const values = [parseAnd()];
    while (match('||')) values.push(parseAnd());
    return values.length === 1
      ? values[0]!
      : { type: 'or', values };
  };

  parseConditional = (): JsonObject => {
    let expression = parseOr();
    if (match('?')) {
      const whenTrue = parseConditional();
      expect(':');
      const whenFalse = parseConditional();
      expression = {
        type: 'conditional',
        condition: expression,
        whenTrue,
        whenFalse
      };
    }
    return expression;
  };

  const result = parseConditional();
  if (peek().type !== 'eof') {
    throw new Error(
      `BOOKKEEPING_EXPRESSION_TRAILING_TOKEN: '${peek().value}' in ${input}`
    );
  }
  return result;
}

function canonical(value: JsonValue): string {
  if (value === null) return 'null';
  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => canonical(item)).join(',')}]`;
  }
  const object = value as Readonly<Record<string, JsonValue>>;
  return `{${Object.keys(object)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonical(object[key] ?? null)}`)
    .join(',')}}`;
}

function direction(value: string): 'DEBIT' | 'CREDIT' | 'ADD' | 'SUB' {
  if (value === '借方') return 'DEBIT';
  if (value === '贷方') return 'CREDIT';
  if (value === '增加') return 'ADD';
  if (value === '减少') return 'SUB';
  throw new Error(`BOOKKEEPING_DIRECTION_UNSUPPORTED: ${value}`);
}

function optionalExpression(value: string | null): JsonObject | null {
  if (value === null || value.trim() === '') return null;
  return compileBookkeepingExpressionV010(value);
}

export function compileBookkeepingBaselineV010(
  source: BookkeepingBaselineSourceV010,
  configurationId: string
): ConfiguratorBurnBody {
  if (source.contractVersion !== '0.1.0') {
    throw new Error('BOOKKEEPING_BASELINE_VERSION_UNSUPPORTED');
  }

  const applicationIds = new Set(
    source.applications.map(application => application.uuid)
  );
  const accountIds = new Set(source.accounts.map(account => account.id));

  const expressionTexts = new Set<string>();
  let compiledExpressionCount = 0;

  const rules = source.policies.map(policy => {
    if (!applicationIds.has(policy.appId)) {
      throw new Error(
        `BOOKKEEPING_POLICY_APPLICATION_MISSING: ${policy.id} -> ${policy.appId}`
      );
    }
    if (!accountIds.has(policy.accountId)) {
      throw new Error(
        `BOOKKEEPING_POLICY_ACCOUNT_MISSING: ${policy.id} -> ${policy.accountId}`
      );
    }

    const compileTracked = (value: string | null): JsonObject | null => {
      if (value === null || value.trim() === '') return null;
      const normalized = value.trim();
      expressionTexts.add(normalized);
      compiledExpressionCount += 1;
      return compileBookkeepingExpressionV010(normalized);
    };

    return {
      sourceId: policy.id,
      applicationId: policy.appId,
      ledgerId: policy.accountId,
      ledgerTitle: policy.accountTitle,
      direction: direction(policy.direction),
      conditionAst:
        compileTracked(policy.entryConditions)
        ?? { type: 'literal', value: true },
      quantityAst: compileTracked(policy.quantityFormula),
      amountAst: compileTracked(policy.amountFormula),
      source: JSON.stringify(policy)
    };
  });

  const compiler = {
    expressionIrVersion: 1,
    uniqueExpressionCount: expressionTexts.size,
    compiledExpressionCount,
    builtinNames: [] as string[]
  };

  const semantic = {
    contractVersion: '0.1.0' as const,
    kind: 'evo.ledger-runtime.compiled-configuration' as const,
    sourceDialect: 'bookkeeping-aviator-v1' as const,
    configurationId,
    accounts: source.accounts.map(account => ({
      id: account.id,
      title: account.title,
      isFinance: account.isFinance
    })),
    applications: source.applications.map(application => ({
      applicationId: application.uuid,
      title: application.title
    })),
    rules,
    compiler
  };

  const semanticDigest = createHash('sha256')
    .update(canonical(semantic as unknown as JsonValue))
    .digest('hex');

  return {
    ...semantic,
    semanticDigest
  };
}
