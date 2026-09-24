import { useState } from 'react';
import { Building2, Coins, ArrowDownRight, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { walletService, type WalletSummary } from '../../services/walletService';
import { formatCurrency } from '../../utils/format';
import { useUsdcNgnRate } from '../../services/fxRateService';
import { getWalletKey, connectWallet } from '../../lib/stellar';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userRole: 'supplier' | 'logistics';
  summary: WalletSummary;
  onSuccess: () => void;
}

export function WithdrawEarningsModal({
  isOpen,
  onClose,
  userId,
  userName,
  userRole,
  summary,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const { rate: usdcRate } = useUsdcNgnRate();
  const [method, setMethod] = useState<'bank_transfer' | 'stellar_usdc'>('bank_transfer');
  const [amount, setAmount] = useState<string>(summary.available > 0 ? String(summary.available) : '');
  const [bankName, setBankName] = useState('First Bank of Nigeria');
  const [accountNumber, setAccountNumber] = useState('3084920194');
  const [accountName, setAccountName] = useState(userName);
  const [stellarAddress, setStellarAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const usdcEquivalent = (numAmount / usdcRate).toFixed(2);

  const handleConnectStellar = async () => {
    try {
      let key = await getWalletKey();
      if (!key) key = await connectWallet();
      if (key) setStellarAddress(key);
    } catch (e: any) {
      toast('error', e.message || 'Could not connect Freighter.');
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (numAmount <= 0) {
      setError('Please enter a valid withdrawal amount.');
      return;
    }

    if (numAmount > summary.available) {
      setError(`Amount exceeds your available escrow balance of ${formatCurrency(summary.available)}.`);
      return;
    }

    if (method === 'bank_transfer') {
      if (!bankName || !accountNumber || !accountName) {
        setError('Please provide complete bank account details.');
        return;
      }
    } else {
      if (!stellarAddress) {
        setError('Please provide or connect your Stellar USDC wallet address.');
        return;
      }
    }

    setLoading(true);
    try {
      await walletService.requestWithdrawal({
        userId,
        userName,
        userRole,
        amount: numAmount,
        method,
        bankDetails:
          method === 'bank_transfer'
            ? { bankName, accountNumber, accountName }
            : undefined,
        stellarPublicKey: method === 'stellar_usdc' ? stellarAddress : undefined,
      });

      toast(
        'success',
        `Payout of ${formatCurrency(numAmount)} disbursed via ${
          method === 'bank_transfer' ? 'Bank Transfer' : 'Stellar USDC'
        }!`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Withdraw Escrow Earnings" size="md">
      <form onSubmit={handleWithdraw} className="space-y-4 text-xs">
        {/* Available Balance Header */}
        <div className="bg-agri-50 border border-agri-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-agri-800 uppercase tracking-wider">
              Available to Withdraw
            </div>
            <div className="text-2xl font-bold text-agri-900 mt-0.5">
              {formatCurrency(summary.available)}
            </div>
            <div className="text-[10px] text-agri-700 mt-0.5">
              ≈ {(summary.available / 1350).toFixed(2)} USDC (Rate: ₦1,350/USDC)
            </div>
          </div>
          <div className="p-2.5 bg-agri-100 text-agri-800 rounded-full">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Payout Method Selector */}
        <div>
          <label className="block font-semibold text-gray-700 mb-1.5">Payout Method</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod('bank_transfer')}
              className={`p-3 rounded-lg border flex items-center gap-2.5 transition-all text-left ${
                method === 'bank_transfer'
                  ? 'border-agri-600 bg-agri-50/50 text-agri-900 ring-1 ring-agri-600'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Building2 className="w-4 h-4 text-agri-700 shrink-0" />
              <div>
                <div className="font-semibold text-xs">Bank Transfer (NGN)</div>
                <div className="text-[10px] text-gray-500">Instant to Nigerian bank</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMethod('stellar_usdc')}
              className={`p-3 rounded-lg border flex items-center gap-2.5 transition-all text-left ${
                method === 'stellar_usdc'
                  ? 'border-agri-600 bg-agri-50/50 text-agri-900 ring-1 ring-agri-600'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Coins className="w-4 h-4 text-agri-700 shrink-0" />
              <div>
                <div className="font-semibold text-xs">Stellar USDC</div>
                <div className="text-[10px] text-gray-500">Instant to Freighter wallet</div>
              </div>
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="font-semibold text-gray-700">Amount to Withdraw (₦)</label>
            <button
              type="button"
              onClick={() => setAmount(String(summary.available))}
              className="text-[11px] text-agri-700 font-semibold hover:underline"
            >
              Withdraw Max ({formatCurrency(summary.available)})
            </button>
          </div>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            max={summary.available}
            min={1}
            required
          />
          {numAmount > 0 && (
            <p className="text-[11px] text-gray-500 mt-1">
              Estimated USDC payout: <span className="font-semibold text-gray-800">{usdcEquivalent} USDC</span>
            </p>
          )}
        </div>

        {/* Dynamic Details */}
        {method === 'bank_transfer' ? (
          <div className="space-y-2.5 bg-gray-50 p-3.5 rounded-lg border border-gray-200">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Bank Name</label>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-agri-500"
              >
                <option value="First Bank of Nigeria">First Bank of Nigeria</option>
                <option value="GTBank">Guaranty Trust Bank (GTB)</option>
                <option value="Zenith Bank">Zenith Bank</option>
                <option value="Access Bank">Access Bank</option>
                <option value="United Bank for Africa (UBA)">United Bank for Africa (UBA)</option>
                <option value="Kuda Bank">Kuda Microfinance Bank</option>
                <option value="OPay">OPay Digital Services</option>
                <option value="Moniepoint">Moniepoint MFB</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Account Number</label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="0123456789"
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Account Name</label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Account Holder Name"
                  required
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 bg-gray-50 p-3.5 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-gray-600">Stellar Public Key</label>
              <button
                type="button"
                onClick={handleConnectStellar}
                className="text-[11px] text-blue-600 font-semibold hover:underline"
              >
                Auto-fill from Freighter
              </button>
            </div>
            <Input
              value={stellarAddress}
              onChange={(e) => setStellarAddress(e.target.value)}
              placeholder="G..."
              required
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="w-1/3">
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={summary.available <= 0 || numAmount <= 0}
            className="w-2/3 bg-agri-700 hover:bg-agri-800 text-white"
          >
            Confirm & Withdraw Payout
          </Button>
        </div>
      </form>
    </Modal>
  );
}
