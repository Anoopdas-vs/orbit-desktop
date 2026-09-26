import {
  MarketQuote,
  PreparedSpotOrder,
  TradeJournalEntry,
  TradingLimits,
  TradingMode
} from '../../types/trading';
import { killSwitch } from '../../core/kill-switch';

export const DEFAULT_TRADING_LIMITS: TradingLimits = {
  maxOrderInr: 1000,
  dailyCumulativeLimitInr: 5000,
  dailySpentInr: 0,
  cooldownSeconds: 60,
  allowedPairs: ['BTCUSDT', 'ETHUSDT'],
};

export class BinanceTradingAdapter {
  private mode: TradingMode = 'PAPER_TRADING';
  private limits: TradingLimits = { ...DEFAULT_TRADING_LIMITS };
  private mockPriceBtcUsdt = 96450.0;
  private mockPriceEthUsdt = 2820.0;
  private usdtToInrRate = 86.5; // Estimated exchange rate for calculation

  public setMode(mode: TradingMode): void {
    this.mode = mode;
  }

  public getMode(): TradingMode {
    return this.mode;
  }

  public getLimits(): TradingLimits {
    return { ...this.limits };
  }

  public updateLimits(limits: Partial<TradingLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  /**
   * Public Price Lookup (No API keys required)
   */
  public async getPublicPrice(symbol: string): Promise<MarketQuote> {
    const cleanSymbol = symbol.toUpperCase().replace('/', '');

    // Try fetching from public Binance REST ticker API (non-authenticated)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${cleanSymbol}`, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.price);
        return {
          symbol: cleanSymbol,
          price,
          inrEquivalentPrice: Math.round(price * this.usdtToInrRate),
          timestamp: new Date().toISOString(),
          source: 'binance-public-ticker'
        };
      }
    } catch {
      // Fallback to simulated offline market feed
    }

    const price = cleanSymbol === 'BTCUSDT' ? this.mockPriceBtcUsdt : this.mockPriceEthUsdt;
    return {
      symbol: cleanSymbol,
      price,
      inrEquivalentPrice: Math.round(price * this.usdtToInrRate),
      timestamp: new Date().toISOString(),
      source: 'mock-feed'
    };
  }

  /**
   * Prepares a Spot Order with risk checks, limits, and exact required confirmation phrase
   */
  public async prepareSpotOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    inrAmount: number;
  }): Promise<{ order?: PreparedSpotOrder; error?: string }> {
    if (killSwitch.isEngaged()) {
      return { error: 'Trading is blocked: Emergency Kill Switch is active.' };
    }

    if (this.mode === 'OFF') {
      return { error: 'Trading module is currently OFF. Please enable Paper Trading in settings.' };
    }

    if (this.mode === 'READ_ONLY') {
      return { error: 'Trading module is set to READ_ONLY. Orders cannot be prepared or executed.' };
    }

    const cleanSymbol = params.symbol.toUpperCase().replace('/', '');
    if (!this.limits.allowedPairs.includes(cleanSymbol)) {
      return { error: `Pair "${cleanSymbol}" is not in the approved trading pairs (${this.limits.allowedPairs.join(', ')}).` };
    }

    if (params.inrAmount <= 0) {
      return { error: 'Order amount must be greater than zero.' };
    }

    if (params.inrAmount > this.limits.maxOrderInr) {
      return { error: `Order amount (₹${params.inrAmount}) exceeds maximum per-order limit of ₹${this.limits.maxOrderInr}.` };
    }

    if (this.limits.dailySpentInr + params.inrAmount > this.limits.dailyCumulativeLimitInr) {
      return {
        error: `Order amount would exceed daily trading limit. Used: ₹${this.limits.dailySpentInr}, Limit: ₹${this.limits.dailyCumulativeLimitInr}.`
      };
    }

    // Check cooldown
    if (this.limits.lastOrderTimestamp) {
      const elapsedSec = (Date.now() - new Date(this.limits.lastOrderTimestamp).getTime()) / 1000;
      if (elapsedSec < this.limits.cooldownSeconds) {
        return {
          error: `Cooldown active. Please wait ${Math.ceil(this.limits.cooldownSeconds - elapsedSec)} seconds before placing another order.`
        };
      }
    }

    const quote = await this.getPublicPrice(cleanSymbol);
    const amountInUsdt = params.inrAmount / this.usdtToInrRate;
    const estimatedQuantity = parseFloat((amountInUsdt / quote.price).toFixed(6));
    const estimatedFeeInr = Math.round(params.inrAmount * 0.001); // 0.1% spot fee
    const formattedPhrase = `Confirm spot ${params.side.toLowerCase()} ${cleanSymbol} for ₹${params.inrAmount}`;

    const order: PreparedSpotOrder = {
      id: crypto.randomUUID(),
      symbol: cleanSymbol,
      side: params.side,
      orderType: 'MARKET',
      inrAmount: params.inrAmount,
      estimatedQuantity,
      unitPriceUsdt: quote.price,
      estimatedFeeInr,
      timestamp: new Date().toISOString(),
      requiredConfirmationPhrase: formattedPhrase,
      confirmedByButton: false,
      status: 'PREPARED',
      disclaimerAccepted: true,
      isPaper: this.mode === 'PAPER_TRADING',
    };

    return { order };
  }

  /**
   * Final Order Execution: Requires BOTH the typed confirmation phrase AND the confirmation button
   */
  public async executeOrder(
    order: PreparedSpotOrder,
    typedPhrase: string,
    buttonConfirmed: boolean
  ): Promise<{ success: boolean; journalEntry?: TradeJournalEntry; error?: string }> {
    if (killSwitch.isEngaged()) {
      return { success: false, error: 'Emergency Kill Switch engaged. Order execution cancelled.' };
    }

    if (!buttonConfirmed) {
      return { success: false, error: 'Order rejected: In-app confirmation button was not clicked.' };
    }

    if (typedPhrase.trim().toLowerCase() !== order.requiredConfirmationPhrase.trim().toLowerCase()) {
      return {
        success: false,
        error: `Confirmation phrase mismatch. Expected: "${order.requiredConfirmationPhrase}", received: "${typedPhrase}"`
      };
    }

    if (this.mode === 'LIVE_SPOT_CONFIRMATION_REQUIRED') {
      // Live order feature-flagged/blocked unless explicit Keychain credentials present
      return {
        success: false,
        error: 'Live exchange order submission is blocked: Live trading requires verified API credentials in macOS Keychain with IP restrictions and withdrawal permissions disabled.'
      };
    }

    // Execute Paper Trade
    this.limits.dailySpentInr += order.inrAmount;
    this.limits.lastOrderTimestamp = new Date().toISOString();

    const journalEntry: TradeJournalEntry = {
      id: crypto.randomUUID(),
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      orderType: order.orderType,
      inrAmount: order.inrAmount,
      executedQuantity: order.estimatedQuantity,
      executionPrice: order.unitPriceUsdt,
      isPaper: true,
      exchangeOrderId: `paper_${Date.now()}`,
      timestamp: new Date().toISOString(),
      notes: `Paper execution fulfilled at ${order.unitPriceUsdt} USDT. Daily limit used: ₹${this.limits.dailySpentInr}/₹${this.limits.dailyCumulativeLimitInr}`,
    };

    return {
      success: true,
      journalEntry,
    };
  }

  /**
   * Technical Analysis & Trading Decision Advisory
   */
  public async getMarketAnalysis(symbol: string) {
    const quote = await this.getPublicPrice(symbol);
    const { tradingAdvisoryDesk } = await import('../../skills/trading-advisory');
    return tradingAdvisoryDesk.evaluateMarket(quote.symbol, quote.price);
  }
}

export const binanceTradingAdapter = new BinanceTradingAdapter();

