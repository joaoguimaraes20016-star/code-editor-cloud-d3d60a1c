// src/lib/automations/conditions.ts
import type { AutomationCondition } from './types';

/**
 * Safely pulls a nested value from the context using dot notation.
 * Example: getFieldValue(ctx, "lead.first_name")
 */
function getFieldValue(context: Record<string, any>, path?: string | null): any {
  if (!path) return undefined;
  const segments = path.split('.');
  let current: any = context;

  for (const segment of segments) {
    if (current == null) return undefined;
    current = current[segment];
  }

  return current;
}

export function evaluateCondition(
  condition: AutomationCondition,
  context: Record<string, any>,
): boolean {
  const c: any = condition as any;
  const fieldPath: string | undefined = c.field;
  const operator: string = c.operator;
  const expected = c.value;

  const actual = getFieldValue(context, fieldPath);

  switch (operator) {
    case 'equals':
      return actual === expected;
    case 'not_equals':
      return actual !== expected;
    case 'contains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.toLowerCase().includes(expected.toLowerCase());
      }
      if (Array.isArray(actual)) {
        return actual.includes(expected);
      }
      return false;
    case 'greater_than':
      return Number(actual) > Number(expected);
    case 'greater_or_equal':
      return Number(actual) >= Number(expected);
    case 'less_than':
      return Number(actual) < Number(expected);
    case 'less_or_equal':
      return Number(actual) <= Number(expected);
    case 'is_set':
      return actual !== null && actual !== undefined && actual !== '';
    case 'is_not_set':
      return actual === null || actual === undefined || actual === '';
    default:
      // Unknown operator – fail closed (no-op) instead of blowing up runtime
      console.warn('[automations] Unknown operator', operator, 'for condition', condition);
      return false;
  }
}

/**
 * Evaluates an array of conditions with the given boolean operator.
 * If no conditions are provided, returns true (no filters).
 */
export function evaluateConditions(
  conditions: AutomationCondition[] | undefined | null,
  context: Record<string, any>,
  operator: 'AND' | 'OR' = 'AND',
): boolean {
  if (!conditions || conditions.length === 0) return true;

  if (operator === 'AND') {
    return conditions.every((c) => evaluateCondition(c, context));
  }

  // OR
  return conditions.some((c) => evaluateCondition(c, context));
}
