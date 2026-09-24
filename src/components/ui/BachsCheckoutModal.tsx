import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Copy,
  Clock,
  ShieldCheck,
  X,
  CreditCard,
  Building2,
  PhoneCall,
  QrCode,
  Loader2,
  Lock,
} from 'lucide-react';
import { formatCurrency } from '../../utils/format';

interface BachsCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (paymentDetails: { reference: string; method: string; amount: number }) => void;
  amount: number;
  currency?: string;
  customerName: string;
  customerEmail: string;
  transactionId: string;
  commodityName?: string;
}

export function BachsCheckoutModal({
  open,
  onClose,
  onSuccess,
  amount,
  currency = 'NGN',
  customerName,
  customerEmail,
  transactionId,
  commodityName,
}: BachsCheckoutModalProps) {
  const [activeTab, setActiveTab] = useState<'transfer' | 'card' | 'ussd' | 'qr'>('transfer');
  const [copied, setCopied] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [selectedBank, setSelectedBank] = useState('058'); // GTBank

  // Virtual account generated for this transaction
  const virtualAccount = {
    bankName: 'Wema Bank / Bachs Gateway',
    accountNumber: `90${transactionId.replace(/\D/g, '').slice(-8).padStart(8, '4289')}`,
    accountName: `AGRIFLOW ESCROW - ${customerName.split(' ')[0] || 'BUYER'}`,
  };

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [open]);

  if (!open) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSimulatePayment = async () => {
    setIsVerifying(true);
    await new Promise((r) => setTimeout(r, 1800));
    setIsVerifying(false);
    setIsCompleted(true);
    await new Promise((r) => setTimeout(r, 1200));
    onSuccess({
      reference: `bachs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      method: activeTab,
      amount,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-950/70 backdrop-blur-sm transition-opacity"
        onClick={!isVerifying ? onClose : undefined}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in zoom-in-95 duration-200">
        {/* Header with Bachs branding */}
        <div className="bg-linear-to-r from-gray-900 via-gray-800 to-gray-900 text-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-sm">
                B
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-white">bachs.io</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-200 border border-blue-400/30">
                    Checkout
                  </span>
                </div>
                <div className="text-xs text-gray-300">
                  {commodityName ? `${commodityName} · Escrow Gateway` : 'Escrow Payment Gateway'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-base font-extrabold text-white tracking-tight">
                  {formatCurrency(amount, currency)}
                </div>
                <div className="text-[10px] text-gray-400">{customerEmail}</div>
              </div>
              {!isVerifying && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors ml-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50/80 px-4 pt-2 gap-1 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('transfer')}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-lg font-semibold transition-all border-b-2 cursor-pointer ${
              activeTab === 'transfer'
                ? 'bg-white text-gray-900 border-blue-600 shadow-2xs'
                : 'text-gray-500 border-transparent hover:text-gray-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Bank Transfer
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('card')}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-lg font-semibold transition-all border-b-2 cursor-pointer ${
              activeTab === 'card'
                ? 'bg-white text-gray-900 border-blue-600 shadow-2xs'
                : 'text-gray-500 border-transparent hover:text-gray-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Card
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ussd')}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-lg font-semibold transition-all border-b-2 cursor-pointer ${
              activeTab === 'ussd'
                ? 'bg-white text-gray-900 border-blue-600 shadow-2xs'
                : 'text-gray-500 border-transparent hover:text-gray-900'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            USSD
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-lg font-semibold transition-all border-b-2 cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-white text-gray-900 border-blue-600 shadow-2xs'
                : 'text-gray-500 border-transparent hover:text-gray-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            NQR Code
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {isCompleted ? (
            <div className="py-8 text-center space-y-3 animate-in zoom-in-95">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Payment Successful!</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Bachs.io confirmed collection of {formatCurrency(amount, currency)}. Funds are locked in
                escrow until delivery confirmation.
              </p>
            </div>
          ) : isVerifying ? (
            <div className="py-10 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-gray-900">Awaiting Bank Settlement...</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Connecting to Nigerian Inter-Bank Settlement System (NIBSS) and Bachs webhook listener...
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Tab 1: Virtual Bank Transfer */}
              {activeTab === 'transfer' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Expires in {formatTime(timeLeft)}</span>
                      <p className="text-amber-800 text-[11px] mt-0.5">
                        Transfer the exact amount below to this dynamic virtual account from any bank app.
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                      <span className="text-xs text-gray-500">Bank Name</span>
                      <span className="text-xs font-bold text-gray-900">{virtualAccount.bankName}</span>
                    </div>

                    <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                      <div>
                        <div className="text-xs text-gray-500">Account Number</div>
                        <div className="text-base font-mono font-bold text-blue-700 tracking-wider">
                          {virtualAccount.accountNumber}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(virtualAccount.accountNumber, 'acc')}
                        className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copied === 'acc' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                      <span className="text-xs text-gray-500">Account Name</span>
                      <span className="text-xs font-semibold text-gray-800 truncate max-w-[200px]">
                        {virtualAccount.accountName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Amount Due</span>
                      <span className="text-sm font-extrabold text-gray-900">
                        {formatCurrency(amount, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Card Payment */}
              {activeTab === 'card' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Card Number</label>
                    <input
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-blue-600 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Expiry Date</label>
                      <input
                        type="text"
                        placeholder="MM / YY"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-blue-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">CVV</label>
                      <input
                        type="password"
                        placeholder="123"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-blue-600 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-1">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Protected by 256-bit SSL encryption & 3D-Secure OTP</span>
                  </div>
                </div>
              )}

              {/* Tab 3: USSD Payment */}
              {activeTab === 'ussd' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Select Your Nigerian Bank
                    </label>
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="058">Guaranty Trust Bank (*737#)</option>
                      <option value="057">Zenith Bank (*966#)</option>
                      <option value="044">Access Bank (*901#)</option>
                      <option value="033">United Bank for Africa (*919#)</option>
                      <option value="011">First Bank (*894#)</option>
                      <option value="214">First City Monument Bank (*389#)</option>
                      <option value="035">Wema Bank (*945#)</option>
                    </select>
                  </div>

                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center space-y-2">
                    <div className="text-xs text-gray-500">Dial code from registered phone number:</div>
                    <div className="text-lg font-mono font-bold text-gray-900 tracking-wider">
                      *737*000*4829#
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('*737*000*4829#', 'ussd')}
                      className="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied === 'ussd' ? 'Copied Code' : 'Copy USSD Code'}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 4: NQR Scan */}
              {activeTab === 'qr' && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center space-y-3">
                  <div className="w-36 h-36 bg-white border border-gray-300 rounded-lg p-2 mx-auto flex items-center justify-center shadow-inner">
                    <QrCode className="w-28 h-28 text-gray-900" />
                  </div>
                  <div className="text-xs text-gray-600">
                    Scan with any Nigerian Bank Mobile App (NQR option) to pay instantly.
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSimulatePayment}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {activeTab === 'transfer'
                    ? "I have sent the money (Verify Payment)"
                    : activeTab === 'card'
                    ? `Pay ${formatCurrency(amount, currency)} with Card`
                    : "Confirm & Verify Payment"}
                </button>
              </div>

              {/* Trust Badge */}
              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-100">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Secured by Bachs.io Infrastructure
                </span>
                <span>ID: {transactionId}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
