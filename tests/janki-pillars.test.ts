import { describe, it, expect } from 'vitest';
import { commandRouter } from '../src/core/router';

describe('Janki Core Automation Pillars - Intent Routing', () => {
  const context = {
    registeredProjects: [{ id: '1', name: 'Web App', rootPath: '/tmp/app' }],
    fastMode: true,
  };

  it('routes "play a song based on my mood" to mood_music skill', async () => {
    const plan = await commandRouter.route('play a song based on my mood', context);
    expect(plan.interpretedIntent).toContain('Play Mood Music');
    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].skillId).toBe('mood_music');
    expect(plan.overallRisk).toBe('LOW');
  });

  it('routes "open binance and advise me if this is the best time to trade" to trading_advisory', async () => {
    const plan = await commandRouter.route(
      'open binance and advise me if this is the best time to trade',
      context
    );
    expect(plan.interpretedIntent).toContain('Binance Technical Trade Advisory');
    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].skillId).toBe('trading_advisory');
    expect(plan.overallRisk).toBe('LOW');
  });

  it('routes "create a report on AI tools" to autonomous_reporter', async () => {
    const plan = await commandRouter.route('create a report on AI software tools', context);
    expect(plan.interpretedIntent).toContain('Generate Autonomous Report');
    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].skillId).toBe('autonomous_reporter');
    expect(plan.overallRisk).toBe('LOW');
  });

  it('routes "act as my mentor" to persona_switch', async () => {
    const plan = await commandRouter.route('act as my mentor and guide me', context);
    expect(plan.interpretedIntent).toContain('Switch Persona');
    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].skillId).toBe('persona_switch');
    expect(plan.actions[0].params.persona).toBe('MENTOR');
    expect(plan.overallRisk).toBe('LOW');
  });

  it('routes "skip youtube ad" to youtube_ad_skipper', async () => {
    const plan = await commandRouter.route('skip youtube ad', context);
    expect(plan.interpretedIntent).toContain('Skip YouTube Ad');
    expect(plan.actions[0].skillId).toBe('youtube_ad_skipper');
  });
});
