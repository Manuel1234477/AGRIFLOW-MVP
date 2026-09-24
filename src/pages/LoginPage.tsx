import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { CheckCircle2, Loader2 } from 'lucide-react';

const LEFT_FEATURES = [
  'Payments protected by Stellar smart-contract escrow.',
  'Verified supply-demand matching in under 18 hours.',
  'Full visibility for every party, from farm to delivery.',
];

function AuthLeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-5/12 xl:w-[42%] flex-col bg-[#0c1e0e] p-10 xl:p-14 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 80%, rgba(34,197,94,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(21,128,61,0.06) 0%, transparent 50%)',
        }}
      />

      <div className="relative flex items-center gap-2.5 mb-auto">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2C8 2 3 5 3 9a5 5 0 0010 0c0-4-5-7-5-7z" fill="#4ade80" />
            <path d="M8 6v6M5 9h6" stroke="#0c1e0e" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-white font-bold text-base tracking-tight">AgriFlow</span>
      </div>

      <div className="relative my-auto py-10">
        <h1 className="text-white text-3xl xl:text-4xl font-bold leading-tight tracking-tight mb-8">
          Agricultural trade,<br />end to end.
        </h1>
        <ul className="space-y-4">
          {LEFT_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <CheckCircle2 size={16} className="text-green-400 mt-0.5 shrink-0" />
              <span className="text-white/70 text-sm leading-relaxed">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative border-t border-white/10 pt-8">
        <p className="text-white/50 text-sm leading-relaxed italic">
          &ldquo;We used to send half the money up front and pray. Now the payment sits with
          AgriFlow until my driver signs off on the load. I have not had a single argument
          about money since we moved across.&rdquo;
        </p>
        <p className="text-white/30 text-xs mt-3 font-medium">— Chukwuemeka O., Grain Buyer · Kano</p>
      </div>
    </div>
  );
}

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

  const inputCls =
    'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all placeholder:text-gray-400 text-gray-900 bg-white';

  return (
    <div className="min-h-screen flex">
      <AuthLeftPanel />

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-white p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-7 h-7 rounded-md bg-[#0c1e0e] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2C8 2 3 5 3 9a5 5 0 0010 0c0-4-5-7-5-7z" fill="#4ade80" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-base">AgriFlow</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Sign in</h2>
            <p className="text-sm text-gray-500 mt-1.5">
              Access your agricultural trade dashboard.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-semibold text-gray-900 hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
