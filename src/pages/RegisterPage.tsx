import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import type { UserRole } from '../types';
import { CheckCircle2 } from 'lucide-react';

const LEFT_FEATURES = [
  'Payments protected by smart-contract escrow.',
  'Verified supply-demand matching in under 18 hours.',
  'Full visibility for every party, from farm to delivery.',
];


function AuthLeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-5/12 xl:w-[42%] flex-col bg-[#0c1e0e] p-10 xl:p-14 relative overflow-hidden">
      {/* Background texture */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 80%, rgba(34,197,94,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(21,128,61,0.06) 0%, transparent 50%)',
        }}
      />

      {/* Logo */}
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

      {/* Main copy */}
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

      {/* Testimonial */}
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

export function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<UserRole>('buyer');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleRoleSelect = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast('error', 'Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      await register({
        name,
        organizationName: organizationName || name,
        email,
        password,
        role,
        phone,
        location,
      });
      toast('success', 'Account created successfully.');
      navigate('/app/dashboard');
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Registration failed.');
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
      <div className="flex-1 flex items-center justify-center bg-white p-6 sm:p-10 overflow-y-auto">
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

          {step === 1 ? (
            <>
              <div className="mb-7">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Create your account</h2>
                <p className="text-sm text-gray-500 mt-1.5">
                  Select how you will use AgriFlow. This cannot be changed later.
                </p>
              </div>

              <form onSubmit={handleRoleSelect} className="space-y-3">
                {[
                  { value: 'buyer' as UserRole, label: 'Buyer', desc: 'Post demand, review matches, pay and confirm delivery.' },
                  { value: 'supplier' as UserRole, label: 'Supplier', desc: 'List available supply, accept requests and fulfil orders.' },
                  { value: 'logistics' as UserRole, label: 'Logistics Provider', desc: 'Accept transport jobs, confirm pickup and delivery.' },
                ].map(({ value, label, desc }) => (
                  <label
                    key={value}
                    className={`flex items-start gap-3 border rounded-lg p-4 cursor-pointer transition-all ${
                      role === value
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={value}
                      checked={role === value}
                      onChange={() => setRole(value)}
                      className="mt-0.5 accent-gray-900"
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                    </div>
                  </label>
                ))}

                <p className="text-xs text-gray-400 pt-1">
                  Operations accounts are provisioned internally and do not appear here.
                </p>

                <button
                  type="submit"
                  className="w-full mt-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  Continue
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-gray-900 hover:underline">
                  Log in
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="mb-7">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-gray-400 hover:text-gray-700 mb-3 flex items-center gap-1"
                >
                  ← Change role
                </button>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Account details</h2>
                <p className="text-sm text-gray-500 mt-1.5 capitalize">
                  Signing up as <strong>{role === 'logistics' ? 'Logistics Provider' : role}</strong>
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kola Adesanya"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="e.g. Kola Farms Ltd"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Password <span className="text-red-500">*</span>
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Kano"
                      className={inputCls}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
