import { describe, it, expect } from 'vitest';
import { autonomousReporter } from '../src/skills/autonomous-reporter';

describe('Autonomous Multi-Tool Reporter', () => {
  it('selects appropriate tools for financial & crypto topics', () => {
    const tools = autonomousReporter.selectToolchain('Crypto Market Outlook 2026');
    const toolNames = tools.map((t) => t.name);

    expect(toolNames.some((t) => t.includes('Market Data Feed'))).toBe(true);
    expect(toolNames.some((t) => t.includes('Financial Calculator'))).toBe(true);
  });

  it('selects appropriate tools for technical software topics', () => {
    const tools = autonomousReporter.selectToolchain('AI Software Architecture');
    const toolNames = tools.map((t) => t.name);

    expect(toolNames.some((t) => t.includes('GitHub'))).toBe(true);
    expect(toolNames.some((t) => t.includes('Diagram'))).toBe(true);
  });

  it('generates a complete structured report with executive and spoken summaries', async () => {
    const report = await autonomousReporter.generateReport('EV Battery Supply Chain');

    expect(report.id).toBeDefined();
    expect(report.title).toContain('EV Battery');
    expect(report.wordCount).toBeGreaterThan(50);
    expect(report.markdownContent).toContain('Executive Summary');
    expect(report.markdownContent).toContain('Strategic Recommendations');
    expect(report.spokenSummary).toContain('EV Battery');
    expect(report.savedFilePath).toContain('reports/');
  });

  it('stores generated reports in memory registry', () => {
    const reports = autonomousReporter.getReports();
    expect(reports.length).toBeGreaterThan(0);
  });
});
