import { describe, it, expect } from 'vitest';
import { variableResolver, VariableResolver } from '../src/core/workflow/variable-resolver';

describe('Phase 4A: Workflow Variable Resolver', () => {
  const resolver = new VariableResolver();

  const mockContext = {
    context: {
      activeApp: 'Safari',
      userId: 42,
      isDarkMode: true,
    },
    steps: {
      step_1: {
        output: {
          files: ['/Users/test/Downloads/invoice.pdf', '/Users/test/Downloads/receipt.pdf'],
          count: 2,
          metadata: {
            author: 'Anoop',
            tags: ['finance', 'tax'],
          },
          summary: 'Total expenses calculated successfully.',
        },
      },
      step_2: {
        output: {
          generatedText: 'Here is the executive briefing.',
          success: true,
          nested: {
            deep: {
              value: 999,
            },
          },
        },
      },
    },
  };

  describe('Single-Token Exact Type Resolution', () => {
    it('resolves simple string property', () => {
      const res = resolver.resolveString('{{step_1.output.summary}}', mockContext);
      expect(res.resolved).toBe(true);
      expect(res.value).toBe('Total expenses calculated successfully.');
      expect(res.errors.length).toBe(0);
    });

    it('resolves numeric values while preserving number type', () => {
      const res = resolver.resolveString('{{step_1.output.count}}', mockContext);
      expect(res.resolved).toBe(true);
      expect(res.value).toBe(2);
      expect(typeof res.value).toBe('number');
    });

    it('resolves boolean values while preserving boolean type', () => {
      const res = resolver.resolveString('{{step_2.output.success}}', mockContext);
      expect(res.resolved).toBe(true);
      expect(res.value).toBe(true);
      expect(typeof res.value).toBe('boolean');
    });

    it('resolves array values while preserving Array instance', () => {
      const res = resolver.resolveString('{{step_1.output.files}}', mockContext);
      expect(res.resolved).toBe(true);
      expect(Array.isArray(res.value)).toBe(true);
      expect(res.value).toEqual([
        '/Users/test/Downloads/invoice.pdf',
        '/Users/test/Downloads/receipt.pdf',
      ]);
    });

    it('resolves nested object values preserving Object type', () => {
      const res = resolver.resolveString('{{step_1.output.metadata}}', mockContext);
      expect(res.resolved).toBe(true);
      expect(res.value).toEqual({
        author: 'Anoop',
        tags: ['finance', 'tax'],
      });
    });
  });

  describe('Deep Path and Array Index Traversal', () => {
    it('resolves bracket-indexed array elements: [0]', () => {
      const res = resolver.resolveString('{{step_1.output.files[0]}}', mockContext);
      expect(res.resolved).toBe(true);
      expect(res.value).toBe('/Users/test/Downloads/invoice.pdf');
    });

    it('resolves second array element: [1]', () => {
      const res = resolver.resolveString('{{step_1.output.files[1]}}', mockContext);
      expect(res.resolved).toBe(true);
      expect(res.value).toBe('/Users/test/Downloads/receipt.pdf');
    });

    it('resolves dot-notated array index: .0', () => {
      const res = resolver.resolveString('{{step_1.output.files.0}}', mockContext);
      expect(res.resolved).toBe(true);
      expect(res.value).toBe('/Users/test/Downloads/invoice.pdf');
    });

    it('resolves deep multi-level nested property', () => {
      const res = resolver.resolveString('{{step_2.output.nested.deep.value}}', mockContext);
      expect(res.resolved).toBe(true);
      expect(res.value).toBe(999);
    });

    it('resolves context variables', () => {
      const res = resolver.resolveString('{{context.activeApp}}', mockContext);
      expect(res.resolved).toBe(true);
      expect(res.value).toBe('Safari');
    });
  });

  describe('Embedded Multiple Variables & String Interpolation', () => {
    it('interpolates multiple variables into text string', () => {
      const template = 'Found {{step_1.output.count}} files in {{context.activeApp}}. First file: {{step_1.output.files[0]}}';
      const res = resolver.resolveString(template, mockContext);
      expect(res.resolved).toBe(true);
      expect(res.value).toBe(
        'Found 2 files in Safari. First file: /Users/test/Downloads/invoice.pdf'
      );
    });

    it('handles whitespace inside curly brackets', () => {
      const template = '{{  step_1.output.summary   }}';
      const res = resolver.resolveString(template, mockContext);
      expect(res.resolved).toBe(true);
      expect(res.value).toBe('Total expenses calculated successfully.');
    });
  });

  describe('Error Handling and Missing Variables', () => {
    it('returns error when step does not exist', () => {
      const res = resolver.resolveString('{{step_99.output.data}}', mockContext);
      expect(res.resolved).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors[0]).toContain('Step "step_99" was not found');
    });

    it('returns error when property does not exist on step output', () => {
      const res = resolver.resolveString('{{step_1.output.nonexistent}}', mockContext);
      expect(res.resolved).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors[0]).toContain('resolved to undefined');
    });

    it('returns error when array index is out of bounds', () => {
      const res = resolver.resolveString('{{step_1.output.files[10]}}', mockContext);
      expect(res.resolved).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors[0]).toContain('resolved to undefined');
    });

    it('returns error for empty path', () => {
      const res = resolver.resolveString('{{   }}', mockContext);
      expect(res.resolved).toBe(false);
      expect(res.errors[0]).toContain('Empty variable path');
    });
  });

  describe('Security and Prototype Pollution Guards', () => {
    it('rejects __proto__ traversal attempts', () => {
      const res = resolver.resolveString('{{step_1.__proto__.polluted}}', mockContext);
      expect(res.resolved).toBe(false);
      expect(res.errors[0]).toContain('Security violation');
      expect(res.errors[0]).toContain('__proto__');
    });

    it('rejects constructor traversal attempts', () => {
      const res = resolver.resolveString('{{step_1.constructor.name}}', mockContext);
      expect(res.resolved).toBe(false);
      expect(res.errors[0]).toContain('Security violation');
      expect(res.errors[0]).toContain('constructor');
    });

    it('rejects prototype traversal attempts', () => {
      const res = resolver.resolveString('{{step_1.prototype.something}}', mockContext);
      expect(res.resolved).toBe(false);
      expect(res.errors[0]).toContain('Security violation');
      expect(res.errors[0]).toContain('prototype');
    });
  });

  describe('Recursive Parameter Object and Array Resolution', () => {
    it('resolves complex nested parameter objects in resolveStepParams', () => {
      const params = {
        targetFile: '{{step_1.output.files[0]}}',
        options: {
          appName: '{{context.activeApp}}',
          count: '{{step_1.output.count}}',
          nestedList: ['{{step_1.output.files[1]}}', 'static-item'],
        },
        staticParam: 12345,
      };

      const { resolvedParams, success, errors } = resolver.resolveStepParams(params, mockContext);
      expect(success).toBe(true);
      expect(errors.length).toBe(0);
      expect(resolvedParams.targetFile).toBe('/Users/test/Downloads/invoice.pdf');
      expect(resolvedParams.options.appName).toBe('Safari');
      expect(resolvedParams.options.count).toBe(2);
      expect(resolvedParams.options.nestedList).toEqual([
        '/Users/test/Downloads/receipt.pdf',
        'static-item',
      ]);
      expect(resolvedParams.staticParam).toBe(12345);
    });

    it('collects all errors when resolving step parameters with missing variables', () => {
      const params = {
        valid: '{{context.activeApp}}',
        invalid1: '{{step_unknown.data}}',
        nested: {
          invalid2: '{{step_1.output.missing_prop}}',
        },
      };

      const { success, errors } = resolver.resolveStepParams(params, mockContext);
      expect(success).toBe(false);
      expect(errors.length).toBe(2);
    });

    it('works when steps is a Map instance', () => {
      const mapSteps = new Map<string, any>();
      mapSteps.set('step_1', mockContext.steps.step_1);

      const mapContext = {
        context: mockContext.context,
        steps: mapSteps,
      };

      const res = resolver.resolveString('{{step_1.output.count}}', mapContext);
      expect(res.resolved).toBe(true);
      expect(res.value).toBe(2);
    });
  });
});
