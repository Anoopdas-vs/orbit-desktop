import { z } from 'zod';

export const TradingModeSchema = z.enum([
  'OFF',
  'READ_ONLY',
  'PAPER_TRADING',
  'LIVE_SPOT_CONFIRMATION_REQUIRED'
]);
export type TradingMode = z.infer<typeof TradingModeSchema>;

export const OrderSideSchema = z.enum(['BUY', 'SELL']);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderTypeSchema = z.enum(['MARKET', 'LIMIT']);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export interface TradingLimits {
  maxOrderInr: number;
  dailyCumulativeLimitInr: number;
  dailySpentInr: number;
  cooldownSeconds: number;
  lastOrderTimestamp?: string;
  allowedPairs: string[];
}

export interface MarketQuote {
  symbol: string;
  price: number;
  inrEquivalentPrice: number;
  timestamp: string;
  source: 'binance-public-ticker' | 'mock-feed';
}

export interface PreparedSpotOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  inrAmount: number;
  estimatedQuantity: number;
  unitPriceUsdt: number;
  estimatedFeeInr: number;
  timestamp: string;
  requiredConfirmationPhrase: string;
  userConfirmationPhrase?: string;
  confirmedByButton: boolean;
  status: 'PREPARED' | 'CONFIRMING' | 'EXECUTED_PAPER' | 'EXECUTED_LIVE' | 'REJECTED' | 'CANCELLED';
  disclaimerAccepted: boolean;
  isPaper: boolean;
}

export interface TradeJournalEntry {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  inrAmount: number;
  executedQuantity: number;
  executionPrice: number;
  isPaper: boolean;
  exchangeOrderId?: string;
  timestamp: string;
  rawResponse?: Record<string, any>;
  notes?: string;
}
