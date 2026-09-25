import { useState } from 'react';
import { Wallet, ArrowDownRight, Clock, CheckCircle2, History } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { walletService, type WalletSummary } from '../../services/walletService';
import { WithdrawEarningsModal } from './WithdrawEarningsModal';

interface Props {
  userId: string;
  userName: string;
  userRole: 'supplier' | 'logistics';
  onUpdated?: () => void;
}

export function EscrowEarningsCard({ userId, userName, userRole, onUpdated }: Props) {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const summary: WalletSummary =
    userRole === 'supplier'
      ? walletService.getSupplierBalance(userId)
      : walletService.getLogisticsBalance(userId);

  const withdrawals = walletService.getWithdrawals(userId);

  const handleSuccess = () => {
    if (onUpdated) onUpdated();
  };

  return (
    <>
      <Card className="mb-6 overflow-hidden border-agri-200 bg-gradient-to-br from-white via-white to-agri-50/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-agri-100 text-agri-800 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">
                Escrow Earnings & Payouts
              </h2>
              <p className="text-xs text-gray-500">
                {userRole === 'supplier' ? 'Commodity sales payouts released from Escrow' : 'Haulage fees disbursed from Escrow'}
              </p>

            </div>
          </div>

          <div className="flex items-center gap-2">
            {withdrawals.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                icon={<History className="w-3.5 h-3.5" />}
                onClick={() => setShowHistoryModal(true)}
              >
                Payout History ({withdrawals.length})
              </Button>
            )}
            <Button
              size="sm"
              icon={<ArrowDownRight className="w-3.5 h-3.5" />}
              disabled={summary.available <= 0}
              onClick={() => setShowWithdrawModal(true)}
              className="bg-agri-700 hover:bg-agri-800 text-white font-semibold"
            >
              Request Withdrawal
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Available Balance */}
            <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Available for Payout
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-950">
                {formatCurrency(summary.available)}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1">
                ≈ {(summary.available / 1350).toFixed(2)} USDC (Released from Escrow)
              </div>
            </div>

            {/* Pending In Escrow */}
            <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                  Locked in Active Escrow
                </span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-950">
                {formatCurrency(summary.pendingEscrow)}
              </div>
              <div className="text-[11px] text-amber-700 mt-1">
                Releases automatically on delivery confirmation
              </div>
            </div>

            {/* Total Earned (Cumulative) */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Total Revenue Earned
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.totalEarned)}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Across {summary.completedCount} completed {userRole === 'supplier' ? 'transactions' : 'deliveries'}
              </div>
            </div>

            {/* Total Withdrawn */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Total Withdrawn
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.withdrawn)}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Disbursed to Bank / USDC Wallet
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal Modal */}
      <WithdrawEarningsModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        userId={userId}
        userName={userName}
        userRole={userRole}
        summary={summary}
        onSuccess={handleSuccess}
      />

      {/* Payout History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Payout & Withdrawal History</h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
              >
                ✕ Close
              </button>
            </div>

            {withdrawals.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">No withdrawals yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {withdrawals.map((w) => (
                  <div key={w.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono text-[11px] font-semibold text-gray-700">{w.id}</div>
                      <div className="text-gray-900 font-semibold mt-0.5">
                        {formatCurrency(w.amount)}
                      </div>
                      <div className="text-gray-500 text-[10px]">
                        {w.method === 'bank_transfer'
                          ? `Bank Transfer (${w.bankDetails?.bankName} - ${w.bankDetails?.accountNumber})`
                          : `Crypto USDC (${(w.walletAddress || w.stellarPublicKey)?.slice(0, 10)}…)`}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                        ✓ Disbursed
                      </span>
                      {w.payoutTxHash && (
                        <div className="text-[10px] text-gray-500 mt-1 font-mono">{w.payoutTxHash.slice(0, 10)}…</div>
                      )}
                      <div className="text-[10px] text-gray-400">{formatDateTime(w.createdAt)}</div>
                    </div>
                  </div>

                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
