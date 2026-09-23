import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { AgriFlowLogo } from '../components/ui/AgriFlowLogo';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast('error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast('success', 'Signed in successfully.');
      navigate('/app/dashboard');
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Sign in failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 border border-gray-200/80 rounded-2xl shadow-sm space-y-6">
          {/* Brand Logo + Language switcher */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-5">
            <AgriFlowLogo size="md" />
            <LanguageSwitcher />
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Sign in to your account</h2>
            <p className="text-xs text-gray-500 mt-1">
              Access your digital agricultural trade dashboard & smart contract escrow.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-agri-600 focus:border-agri-600 outline-none transition-all placeholder:text-gray-400 text-gray-900"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">Password</label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-agri-600 focus:border-agri-600 outline-none transition-all placeholder:text-gray-400 text-gray-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-agri-700 hover:bg-agri-800 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security note */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-agri-600" />
            <span>Encrypted Session · Soroban On-Chain Verification</span>
          </div>

          <div className="text-center text-xs text-gray-500 pt-2 border-t border-gray-100">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-semibold text-agri-700 hover:text-agri-800 hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
