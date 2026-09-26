/**
 * JANKI AI — WORKFLOW VARIABLE RESOLVER (Phase 4A)
 * 
 * Safely resolves dynamic variables and dataflow bindings between workflow steps.
 * Examples:
 *   {{step_1.output.data}}
 *   {{step_1.output.files[0]}}
 *   {{context.activeApp}}
 * 
 * Invariants:
 * 1. Strict dot-notation & bracket-index traversal only.
 * 2. Zero eval(), zero Function(), zero expression evaluation.
 * 3. Strict prototype-pollution defense: blocks '__proto__', 'constructor', 'prototype'.
 * 4. Preserves concrete types (objects, arrays, booleans, numbers) when resolving single-token strings.
 * 5. Returns descriptive error diagnostics on missing paths.
 */

export interface VariableResolutionContext {
  steps?: Map<string, any> | Record<string, any>;
  context?: Record<string, any>;
}

export interface VariableResolutionResult<T = any> {
  value: T;
  resolved: boolean;
  errors: string[];
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const VARIABLE_REGEX = /\{\{\s*([^{}]+?)\s*\}\}/g;

export class VariableResolver {
  /**
   * Resolve an individual expression path from a context object.
   * Path syntax: "step_1.output.files[0].path" or "context.activeApp"
   */
  public resolvePath(path: string, ctx: VariableResolutionContext): { value: any; found: boolean; error?: string } {
    const trimmed = path.trim();
    if (!trimmed) {
      return { value: undefined, found: false, error: 'Empty variable path expression.' };
    }

    // Split path into segments supporting both dot-notation and array indices
    // e.g. "step_1.output.files[0].name" -> ["step_1", "output", "files", "0", "name"]
    const normalized = trimmed.replace(/\[(\d+)\]/g, '.$1');
    const segments = normalized.split('.').map((s) => s.trim()).filter((s) => s.length > 0);

    if (segments.length === 0) {
      return { value: undefined, found: false, error: `Malformed variable path: "${path}"` };
    }

    // Security check: Guard against prototype pollution
    for (const segment of segments) {
      if (FORBIDDEN_KEYS.has(segment)) {
        return {
          value: undefined,
          found: false,
          error: `Security violation: Access to prohibited token "${segment}" in path "${path}".`,
        };
      }
    }

    const rootKey = segments[0];
    let current: any;

    if (rootKey === 'context') {
      current = ctx.context || {};
      segments.shift(); // Remove 'context'
    } else if (rootKey === 'steps') {
      segments.shift(); // Remove 'steps'
      const stepId = segments.shift();
      if (!stepId) {
        return { value: undefined, found: false, error: `Missing step ID after 'steps.' in path "${path}".` };
      }
      if (!ctx.steps) {
        return { value: undefined, found: false, error: `No step results available to resolve step "${stepId}".` };
      }
      current = ctx.steps instanceof Map ? ctx.steps.get(stepId) : ctx.steps[stepId];
      if (current === undefined) {
        return {
          value: undefined,
          found: false,
          error: `Step "${stepId}" was not found in executed step results cache.`,
        };
      }
    } else {
      // Lookup step by ID or key
      if (!ctx.steps) {
        return { value: undefined, found: false, error: `No step results available to resolve step "${rootKey}".` };
      }

      if (ctx.steps instanceof Map) {
        current = ctx.steps.get(rootKey);
      } else {
        current = ctx.steps[rootKey];
      }

      if (current === undefined) {
        return {
          value: undefined,
          found: false,
          error: `Step "${rootKey}" was not found in executed step results cache.`,
        };
      }
      segments.shift(); // Remove rootKey
    }

    // Traverse remaining path
    for (const segment of segments) {
      if (current === null || current === undefined) {
        return {
          value: undefined,
          found: false,
          error: `Cannot read property "${segment}" of ${current === null ? 'null' : 'undefined'} in path "${path}".`,
        };
      }

      if (typeof current !== 'object') {
        return {
          value: undefined,
          found: false,
          error: `Cannot read property "${segment}" of non-object (${typeof current}) in path "${path}".`,
        };
      }

      current = current[segment];
    }

    if (current === undefined) {
      return {
        value: undefined,
        found: false,
        error: `Property path "${path}" resolved to undefined.`,
      };
    }

    return { value: current, found: true };
  }

  /**
   * Resolve any variable templates within a string.
   * If the string is purely a single variable token, returns the raw typed value.
   * If the string has embedded tokens or surrounding text, returns an interpolated string.
   */
  public resolveString(input: string, ctx: VariableResolutionContext): VariableResolutionResult<any> {
    const trimmed = input.trim();
    const singleMatch = trimmed.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);

    // 1. Single exact token match: Preserve concrete type (object, array, number, boolean)
    if (singleMatch) {
      const path = singleMatch[1];
      const res = this.resolvePath(path, ctx);
      if (!res.found) {
        return {
          value: input,
          resolved: false,
          errors: [res.error || `Could not resolve variable: "${path}"`],
        };
      }
      return {
        value: res.value,
        resolved: true,
        errors: [],
      };
    }

    // 2. Embedded tokens within a text string
    const errors: string[] = [];
    const replaced = input.replace(VARIABLE_REGEX, (_match, path) => {
      const res = this.resolvePath(path, ctx);
      if (!res.found) {
        errors.push(res.error || `Could not resolve variable: "${path}"`);
        return _match; // Keep unreplaced
      }
      if (typeof res.value === 'object' && res.value !== null) {
        return JSON.stringify(res.value);
      }
      return String(res.value);
    });

    return {
      value: replaced,
      resolved: errors.length === 0,
      errors,
    };
  }

  /**
   * Recursively resolve all variable bindings inside an arbitrary object or array.
   */
  public resolveValue(value: any, ctx: VariableResolutionContext): VariableResolutionResult<any> {
    if (typeof value === 'string') {
      return this.resolveString(value, ctx);
    }

    if (Array.isArray(value)) {
      const errors: string[] = [];
      const resolvedArray = value.map((item) => {
        const itemRes = this.resolveValue(item, ctx);
        if (!itemRes.resolved) {
          errors.push(...itemRes.errors);
        }
        return itemRes.value;
      });
      return {
        value: resolvedArray,
        resolved: errors.length === 0,
        errors,
      };
    }

    if (value !== null && typeof value === 'object') {
      const errors: string[] = [];
      const resolvedObj: Record<string, any> = {};

      for (const [k, v] of Object.entries(value)) {
        if (FORBIDDEN_KEYS.has(k)) continue;
        const fieldRes = this.resolveValue(v, ctx);
        if (!fieldRes.resolved) {
          errors.push(...fieldRes.errors);
        }
        resolvedObj[k] = fieldRes.value;
      }

      return {
        value: resolvedObj,
        resolved: errors.length === 0,
        errors,
      };
    }

    // Primitive values (number, boolean, null, undefined) pass through directly
    return {
      value,
      resolved: true,
      errors: [],
    };
  }

  /**
   * Resolve all step parameters for a target workflow step.
   */
  public resolveStepParams<T extends Record<string, any>>(
    params: T,
    ctx: VariableResolutionContext
  ): { resolvedParams: T; success: boolean; errors: string[] } {
    const res = this.resolveValue(params, ctx);
    return {
      resolvedParams: res.value as T,
      success: res.resolved,
      errors: res.errors,
    };
  }
}

export const variableResolver = new VariableResolver();
