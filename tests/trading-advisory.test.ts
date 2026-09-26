import { describe, it, expect } from 'vitest';
import { tradingAdvisoryDesk } from '../src/skills/trading-advisory';
import { binanceTradingAdapter } from '../src/adapters/trading/binance-adapter';

describe('Binance Trading Advisory Desk', () => {
  it('evaluates oversold market condition as favorable entry', () => {
    // Current price is near the low ($60,000 when range is $59,500 to $68,000)
    const advisory = tradingAdvisoryDesk.evaluateMarket('BTCUSDT', 60000, 68000, 59500);

    expect(advisory.symbol).toBe('BTCUSDT');
    expect(advisory.rsi14).toBeLessThanOrEqual(40);
    expect(advisory.verdict).toBe('FAVORABLE_FOR_ENTRY');
    expect(advisory.spokenAdvisory).toContain('favorable risk-to-reward');
  });

  it('evaluates overbought market condition as wait for pullback', () => {
    // Current price is near 24h high ($67,800 when range is $60,000 to $68,000)
    const advisory = tradingAdvisoryDesk.evaluateMarket('BTCUSDT', 67800, 68000, 60000);

    expect(advisory.rsi14).toBeGreaterThan(65);
    expect(advisory.verdict).toBe('UNFAVORABLE_WAIT');
    expect(advisory.spokenAdvisory).toContain('NOT the optimal time');
  });

  it('computes support, resistance, stop loss, and take profit levels accurately', () => {
    const advisory = tradingAdvisoryDesk.evaluateMarket('ETHUSDT', 3000, 3100, 2900);

    expect(advisory.keySupport).toBeLessThan(3000);
    expect(advisory.keyResistance).toBeGreaterThan(3000);
    expect(advisory.suggestedStopLoss).toBeLessThan(3000);
    expect(advisory.suggestedTakeProfit).toBeGreaterThan(3000);
    expect(advisory.inrPrice).toBeGreaterThan(200000);
  });

  it('binanceTradingAdapter getMarketAnalysis returns complete advisory', async () => {
    const advisory = await binanceTradingAdapter.getMarketAnalysis('BTCUSDT');
    expect(advisory.symbol).toBe('BTCUSDT');
    expect(advisory.currentPrice).toBeGreaterThan(0);
    expect(advisory.spokenAdvisory.length).toBeGreaterThan(20);
  });
});
