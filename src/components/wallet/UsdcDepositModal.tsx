import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, Clock, RefreshCw, ArrowRight } from 'lucide-react';
import {
  SUPPORTED_CHAINS,
  type SupportedUsdcChain,
  type UsdcDepositQuote,
  type DepositStatusResult,
  requestUsdcDepositQuote,
  getUsdcDepositStatus,
} from '../../lib/nearIntents';

interface UsdcDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  exactAmountUsdc: number;
  title?: string;
  subtitle?: string;
  onSuccess: (quote: UsdcDepositQuote, statusResult: DepositStatusResult) => Promise<void> | void;
}

export function UsdcDepositModal({
  isOpen,
  onClose,
  exactAmountUsdc,
  title = 'Deposit USDC (Multichain)',
  subtitle = 'Transfer USDC directly on Base or Ethereum. Funds are automatically locked into escrow upon receipt.',
  onSuccess,
}: UsdcDepositModalProps) {
  const [chain, setChain] = useState<SupportedUsdcChain>('base');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<UsdcDepositQuote | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      setStatusMsg(null);
      setStatusIsError(false);
      setQuote(null);
      completedRef.current = false;
    }
  }, [isOpen]);

  const handleGetAddress = async () => {
    if (exactAmountUsdc <= 0) {
      setStatusMsg('Invalid deposit amount');
      setStatusIsError(true);
      return;
    }

    setLoading(true);
    setQuote(null);
    setStatusMsg(null);
    setStatusIsError(false);

    try {
      const q = await requestUsdcDepositQuote({
        amountUsdc: exactAmountUsdc,
        sourceChain: chain,
      });
      setQuote(q);
      setStatusMsg(null);
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to get deposit address. Please try again.');
      setStatusIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCheckStatus = useCallback(async () => {
    if (!quote || completedRef.current || isSuccess) return;

    setChecking(true);
    try {
      const result = await getUsdcDepositStatus(quote.depositAddress);

      if (result.status === 'COMPLETED') {
        completedRef.current = true;
        setIsSuccess(true);
        setStatusMsg('Deposit confirmed on-chain!');
        setStatusIsError(false);

        await onSuccess(quote, result);
      } else if (result.status === 'PROCESSING') {
        setStatusMsg('Payment detected on-chain — finalizing deposit...');
        setStatusIsError(false);
      } else if (result.status === 'FAILED' || result.status === 'EXPIRED') {
        setStatusMsg(`Deposit ${result.status.toLowerCase()}. Please request a new address.`);
        setStatusIsError(true);
        setQuote(null);
      } else {
        setStatusMsg('Waiting for your transfer to be detected on-chain...');
        setStatusIsError(false);
      }
    } catch {
      setStatusMsg('Network error while checking deposit status.');
      setStatusIsError(true);
    } finally {
      setChecking(false);
    }
  }, [quote, isSuccess, onSuccess]);

  // Auto-poll status every 5 seconds while quote is active
  useEffect(() => {
    if (!quote || isSuccess || completedRef.current) return;

    const timer = setInterval(() => {
      handleCheckStatus();
    }, 5000);

    return () => clearInterval(timer);
  }, [quote, isSuccess, handleCheckStatus]);

  if (!isOpen) return null;

  const currentChainInfo = SUPPORTED_CHAINS[chain];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-[480px] rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-3.5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {title}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-400 hover:text-gray-900 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div className="text-center py-6 space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 text-2xl font-bold border border-emerald-500/25">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h4 className="text-lg font-bold text-gray-900">
              Deposit Confirmed!
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Your deposit of <strong className="text-emerald-700 font-mono">${exactAmountUsdc.toFixed(2)} USDC</strong> has been verified and credited to escrow.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: Select Network (Base or Ethereum) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                1. Select Deposit Network
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SUPPORTED_CHAINS) as SupportedUsdcChain[]).map((cKey) => {
                  const c = SUPPORTED_CHAINS[cKey];
                  const isSelected = chain === cKey;
                  return (
                    <button
                      key={cKey}
                      type="button"
                      onClick={() => {
                        setChain(cKey);
                        setQuote(null);
                        setStatusMsg(null);
                      }}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <span className={`text-xs font-bold ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                        {c.label}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-0.5">
                        {c.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Exact Amount Due */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700">
                  2. Deposit Amount ($ USDC)
                </label>
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Exact Total Fee
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">$</span>
                <input
                  type="text"
                  readOnly
                  value={exactAmountUsdc.toFixed(2)}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-8 pr-16 text-sm font-bold text-gray-900 cursor-not-allowed select-none"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">USDC</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Fixed total including goods, logistics delivery, and escrow fee.
              </p>
            </div>

            {/* Step 3: Action / Generated Address */}
            {!quote ? (
              <button
                type="button"
                onClick={handleGetAddress}
                disabled={loading}
                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs sm:text-sm font-semibold text-white transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating Address…
                  </>
                ) : (
                  <>
                    Generate {currentChainInfo.label} Deposit Address
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3.5 pt-2 border-t border-gray-100">
                {/* Deposit Address Box */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">
                      Send Exactly: <strong className="text-gray-900 font-mono">{quote.amountUsdc.toFixed(2)} USDC</strong>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                      {currentChainInfo.label}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-500">Your Deposit Address:</span>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                      <span className="font-mono text-xs text-gray-900 break-all select-all flex-1">
                        {quote.depositAddress}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(quote.depositAddress)}
                        className="px-2.5 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition shrink-0 cursor-pointer flex items-center gap-1"
                      >
                        {copied ? 'Copied ✓' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-700 leading-tight">
                    ⚠️ Send ONLY USDC on <strong>{currentChainInfo.label}</strong> network. Other assets will be permanently lost.
                  </p>
                </div>

                {/* Status & Polling Controls */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleCheckStatus}
                    disabled={checking}
                    className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition shadow-xs cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {checking ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Checking Network…
                      </>
                    ) : (
                      <>
                        ✓ Check Deposit Status
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuote(null);
                      setStatusMsg(null);
                    }}
                    className="h-10 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-600 hover:text-gray-900 cursor-pointer"
                  >
                    Change
                  </button>
                </div>

                {/* Status Message */}
                {statusMsg && (
                  <div
                    className={`rounded-xl p-3 text-xs font-medium border flex items-center gap-2 ${
                      statusIsError
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                    }`}
                  >
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>{statusMsg}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
