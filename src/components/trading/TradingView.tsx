import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShieldAlert,
  Lock,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  PowerOff,
} from 'lucide-react';
import { useSafetyStore } from '../../state/useSafetyStore';
import { useAuditStore } from '../../state/useAuditStore';
import { binanceTradingAdapter } from '../../adapters/trading/binance-adapter';
import { MarketQuote, PreparedSpotOrder, TradingMode } from '../../types/trading';

export const TradingView: React.FC = () => {
  const { tradingMode, setTradingMode, tradingLimits } = useSafetyStore();
  const { tradeJournal, addTradeJournal } = useAuditStore();

  const [btcQuote, setBtcQuote] = useState<MarketQuote | null>(null);
  const [ethQuote, setEthQuote] = useState<MarketQuote | null>(null);
  const [inrAmount, setInrAmount] = useState<number>(1000);
  const [selectedSymbol, setSelectedSymbol] = useState<'BTCUSDT' | 'ETHUSDT'>('BTCUSDT');
  const [preparedOrder, setPreparedOrder] = useState<PreparedSpotOrder | null>(null);
  const [typedPhrase, setTypedPhrase] = useState('');
  const [buttonConfirmed, setButtonConfirmed] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchQuotes = async () => {
    setIsLoading(true);
    const btc = await binanceTradingAdapter.getPublicPrice('BTCUSDT');
    const eth = await binanceTradingAdapter.getPublicPrice('ETHUSDT');
    setBtcQuote(btc);
    setEthQuote(eth);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 15000);
    return () => clearInterval(interval);
  }, []);

  const handlePrepareOrder = async () => {
    setFeedbackMessage(null);
    setPreparedOrder(null);
    setTypedPhrase('');
    setButtonConfirmed(false);

    const res = await binanceTradingAdapter.prepareSpotOrder({
      symbol: selectedSymbol,
      side: 'BUY',
      inrAmount,
    });

    if (res.error) {
      setFeedbackMessage({ text: res.error, error: true });
    } else if (res.order) {
      setPreparedOrder(res.order);
    }
  };

  const handleExecuteOrder = async () => {
    if (!preparedOrder) return;
    const res = await binanceTradingAdapter.executeOrder(preparedOrder, typedPhrase, buttonConfirmed);
    if (!res.success) {
      setFeedbackMessage({ text: res.error || 'Order execution rejected', error: true });
    } else if (res.journalEntry) {
      addTradeJournal(res.journalEntry);
      setFeedbackMessage({
        text: `Successfully executed paper spot order for ${preparedOrder.symbol}. Recorded to local journal.`,
        error: false,
      });
      setPreparedOrder(null);
      setTypedPhrase('');
      setButtonConfirmed(false);
    }
  };

  const isPhraseMatch =
    preparedOrder &&
    typedPhrase.trim().toLowerCase() === preparedOrder.requiredConfirmationPhrase.trim().toLowerCase();

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Disclaimer Banner */}
      <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-amber-200">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-amber-300 font-semibold block">Regulatory & Safety Disclosure:</strong>
          This tool does not provide financial advice. Crypto assets are volatile. You are responsible for every submitted order. All live futures, margin, leverage, transfers, and withdrawals are strictly disabled.
        </div>
      </div>

      {/* Trading Mode & Status Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Binance Restrained Trading Desk
          </h2>
          <span className="text-xs text-slate-400">
            Per-order cap: ₹{tradingLimits.maxOrderInr.toLocaleString()} | Daily Limit: ₹{tradingLimits.dailyCumulativeLimitInr.toLocaleString()} (Spent: ₹{tradingLimits.dailySpentInr.toLocaleString()})
          </span>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">Mode:</span>
          <select
            value={tradingMode}
            onChange={(e) => setTradingMode(e.target.value as TradingMode)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          >
            <option value="OFF">OFF (Disabled)</option>
            <option value="READ_ONLY">READ_ONLY (Market Quotes Only)</option>
            <option value="PAPER_TRADING">PAPER_TRADING (Simulated Journal)</option>
            <option value="LIVE_SPOT_CONFIRMATION_REQUIRED">LIVE_SPOT_CONFIRMATION (Gated)</option>
          </select>
        </div>
      </div>

      {/* Live Market Tickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-200">BTC / USDT</span>
            <span className="text-[10px] text-slate-400 font-mono">Public REST Feed</span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            ${btcQuote ? btcQuote.price.toLocaleString() : '...'}
          </div>
          <div className="text-xs font-mono text-slate-400">
            ≈ ₹{btcQuote ? btcQuote.inrEquivalentPrice.toLocaleString() : '...'} INR
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-200">ETH / USDT</span>
            <span className="text-[10px] text-slate-400 font-mono">Public REST Feed</span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            ${ethQuote ? ethQuote.price.toLocaleString() : '...'}
          </div>
          <div className="text-xs font-mono text-slate-400">
            ≈ ₹{ethQuote ? ethQuote.inrEquivalentPrice.toLocaleString() : '...'} INR
          </div>
        </div>
      </div>

      {/* Prepare Gated Order Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Prepare Gated Spot Buy Order
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Trading Pair (Allowlisted):</label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono"
            >
              <option value="BTCUSDT">BTC/USDT</option>
              <option value="ETHUSDT">ETH/USDT</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Order Amount in INR (Max ₹1,000):</label>
            <input
              type="number"
              value={inrAmount}
              onChange={(e) => setInrAmount(Number(e.target.value))}
              max={1000}
              min={100}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handlePrepareOrder}
              disabled={tradingMode === 'OFF' || tradingMode === 'READ_ONLY'}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold py-2.5 rounded-lg transition"
            >
              Prepare Spot Order
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {feedbackMessage && (
          <div
            className={`p-3 rounded-lg text-xs font-mono ${
              feedbackMessage.error
                ? 'bg-rose-950/70 text-rose-300 border border-rose-800'
                : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'
            }`}
          >
            {feedbackMessage.text}
          </div>
        )}

        {/* Prepared Order Dual-Confirmation Panel */}
        {preparedOrder && (
          <div className="bg-slate-950 border border-rose-800/80 rounded-xl p-4 space-y-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Critical Confirmation Gate
              </span>
              <span className="text-[10px] bg-rose-950 text-rose-300 px-2 py-0.5 rounded border border-rose-800 font-mono">
                {preparedOrder.isPaper ? 'PAPER EXECUTION' : 'LIVE ORDER'}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono text-slate-300">
              <div>Pair: <span className="text-blue-400 font-bold">{preparedOrder.symbol}</span></div>
              <div>Side: <span className="text-emerald-400 font-bold">{preparedOrder.side}</span></div>
              <div>Amount: <span className="text-slate-100 font-bold">₹{preparedOrder.inrAmount}</span></div>
              <div>Est. Qty: <span className="text-slate-100">{preparedOrder.estimatedQuantity}</span></div>
            </div>

            {/* Exact Confirmation Phrase Requirement */}
            <div className="space-y-1 pt-1">
              <span className="text-xs text-slate-300 block">
                1. Type the exact phrase to verify:
              </span>
              <div className="text-xs font-mono bg-slate-900 border border-slate-700 p-2 rounded text-amber-300 select-all font-semibold">
                {preparedOrder.requiredConfirmationPhrase}
              </div>
              <input
                type="text"
                value={typedPhrase}
                onChange={(e) => setTypedPhrase(e.target.value)}
                placeholder="Type phrase here..."
                className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Second Confirmation Checkbox & Button */}
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={buttonConfirmed}
                onChange={(e) => setButtonConfirmed(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-rose-500"
              />
              <span>2. I authorize order placement under my sole responsibility.</span>
            </label>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setPreparedOrder(null)}
                className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                disabled={!isPhraseMatch || !buttonConfirmed}
                onClick={handleExecuteOrder}
                className="bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-lg transition"
              >
                Submit Spot Buy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Trade Journal */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
            Local Append-Only Trade Journal
          </h3>
          <span className="text-[11px] font-mono text-slate-400">{tradeJournal.length} record(s)</span>
        </div>

        {tradeJournal.length === 0 ? (
          <div className="text-xs text-slate-400 py-6 text-center font-mono">
            No trades executed yet. Completed paper and spot orders are journaled here with full audit traces.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Side</th>
                  <th className="pb-2">INR Amount</th>
                  <th className="pb-2">Quantity</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Exchange ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {tradeJournal.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2 text-slate-400">{new Date(entry.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2 text-blue-400 font-semibold">{entry.symbol}</td>
                    <td className="py-2 text-emerald-400">{entry.side}</td>
                    <td className="py-2">₹{entry.inrAmount}</td>
                    <td className="py-2">{entry.executedQuantity}</td>
                    <td className="py-2">
                      <span className="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                        {entry.isPaper ? 'PAPER' : 'LIVE'}
                      </span>
                    </td>
                    <td className="py-2 text-slate-400">{entry.exchangeOrderId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
