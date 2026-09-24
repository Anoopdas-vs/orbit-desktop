import { describe, it, expect, beforeEach } from 'vitest';
import { BinanceTradingAdapter } from '../src/adapters/trading/binance-adapter';

describe('Binance Trading Safety & Gating', () => {
  let adapter: BinanceTradingAdapter;

  beforeEach(() => {
    adapter = new BinanceTradingAdapter();
    adapter.setMode('PAPER_TRADING');
    adapter.updateLimits({
      maxOrderInr: 1000,
      dailyCumulativeLimitInr: 5000,
      dailySpentInr: 0,
      allowedPairs: ['BTCUSDT', 'ETHUSDT'],
    });
  });

  it('allows preparing spot order within max limit', async () => {
    const res = await adapter.prepareSpotOrder({
      symbol: 'BTCUSDT',
      side: 'BUY',
      inrAmount: 1000,
    });

    expect(res.error).toBeUndefined();
    expect(res.order).toBeDefined();
    expect(res.order?.symbol).toBe('BTCUSDT');
    expect(res.order?.inrAmount).toBe(1000);
    expect(res.order?.requiredConfirmationPhrase).toBe('Confirm spot buy BTCUSDT for ₹1000');
  });

  it('rejects order exceeding maximum single order limit', async () => {
    const res = await adapter.prepareSpotOrder({
      symbol: 'BTCUSDT',
      side: 'BUY',
      inrAmount: 1500, // Exceeds 1000
    });

    expect(res.order).toBeUndefined();
    expect(res.error).toContain('exceeds maximum per-order limit');
  });

  it('rejects order exceeding daily cumulative limit', async () => {
    adapter.updateLimits({ dailySpentInr: 4500, dailyCumulativeLimitInr: 5000 });

    const res = await adapter.prepareSpotOrder({
      symbol: 'BTCUSDT',
      side: 'BUY',
      inrAmount: 800, // 4500 + 800 = 5300 > 5000
    });

    expect(res.order).toBeUndefined();
    expect(res.error).toContain('would exceed daily trading limit');
  });

  it('rejects unapproved trading pairs', async () => {
    const res = await adapter.prepareSpotOrder({
      symbol: 'DOGEUSDT', // Not in allowedPairs
      side: 'BUY',
      inrAmount: 500,
    });

    expect(res.order).toBeUndefined();
    expect(res.error).toContain('not in the approved trading pairs');
  });

  it('rejects order when trading mode is OFF', async () => {
    adapter.setMode('OFF');

    const res = await adapter.prepareSpotOrder({
      symbol: 'BTCUSDT',
      side: 'BUY',
      inrAmount: 500,
    });

    expect(res.order).toBeUndefined();
    expect(res.error).toContain('Trading module is currently OFF');
  });

  it('requires exact typed phrase to execute prepared order', async () => {
    const prep = await adapter.prepareSpotOrder({
      symbol: 'BTCUSDT',
      side: 'BUY',
      inrAmount: 1000,
    });

    expect(prep.order).toBeDefined();

    // Mismatched phrase
    const badExec = await adapter.executeOrder(
      prep.order!,
      'Yes buy it please',
      true
    );
    expect(badExec.success).toBe(false);
    expect(badExec.error).toContain('Confirmation phrase mismatch');

    // Missing button confirmation
    const noButtonExec = await adapter.executeOrder(
      prep.order!,
      'Confirm spot buy BTCUSDT for ₹1000',
      false
    );
    expect(noButtonExec.success).toBe(false);
    expect(noButtonExec.error).toContain('button was not clicked');

    // Both valid
    const goodExec = await adapter.executeOrder(
      prep.order!,
      'Confirm spot buy BTCUSDT for ₹1000',
      true
    );
    expect(goodExec.success).toBe(true);
    expect(goodExec.journalEntry).toBeDefined();
    expect(goodExec.journalEntry?.symbol).toBe('BTCUSDT');
  });
});
