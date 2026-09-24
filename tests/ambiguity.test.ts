import { describe, it, expect } from 'vitest';
import { detectAmbiguity } from '../src/core/ambiguity-detector';

describe('Ambiguity Detection & Clarification Triggers', () => {
  it('detects vague crypto trading requests and asks for clarification', () => {
    const vaguePrompts = [
      'Take a good trade',
      'Buy something promising',
      'Trade when the market looks bullish',
      'Make me rich with crypto',
      'Invest some money',
    ];

    for (const prompt of vaguePrompts) {
      const res = detectAmbiguity(prompt);
      expect(res.isAmbiguous).toBe(true);
      expect(res.category).toBe('TRADING_VAGUE');
      expect(res.clarificationQuestion).toContain('does not make autonomous investment decisions');
    }
  });

  it('detects feature requests when no project context is provided', () => {
    const res = detectAmbiguity('Add a dark mode feature', ['Web App Client', 'Backend API']);
    expect(res.isAmbiguous).toBe(true);
    expect(res.category).toBe('PROJECT_MISSING');
    expect(res.clarificationQuestion).toContain('Which registered project');
  });

  it('allows feature requests when project is explicitly mentioned in prompt', () => {
    const res = detectAmbiguity('Add a dark mode feature in Web App Client', ['Web App Client', 'Backend API']);
    expect(res.isAmbiguous).toBe(false);
  });

  it('never blocks emergency stop phrases as ambiguous', () => {
    const stopWords = ['stop', 'cancel', 'emergency stop', 'trading off', 'kill'];

    for (const word of stopWords) {
      const res = detectAmbiguity(word);
      expect(res.isAmbiguous).toBe(false);
    }
  });

  it('allows explicit commands with exact parameters', () => {
    const clearPrompts = [
      'Show BTC price',
      'Prepare a BTC spot buy order for ₹1,000',
      'Start the development server',
      'Run tests',
      'Open Binance',
    ];

    for (const prompt of clearPrompts) {
      const res = detectAmbiguity(prompt);
      expect(res.isAmbiguous).toBe(false);
    }
  });
});
