import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { AgriFlowLogo } from '../components/ui/AgriFlowLogo';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import type { UserRole } from '../types';

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

  return (
    <div className="min-h-screen bg-[#f4f5f6] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 border border-gray-200 rounded-xl shadow-xs">
          {/* Brand Logo & Language switcher */}
          <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-5">
            <AgriFlowLogo size="md" />
            <LanguageSwitcher />
          </div>

          {step === 1 ? (
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Create your account</h2>
              <p className="text-xs text-gray-500 mt-1 mb-6">
                Select how you will use AgriFlow. This cannot be changed later.
              </p>

              <form onSubmit={handleRoleSelect} className="space-y-3">
                {/* Buyer Card */}
                <label
                  className={`block border rounded-lg p-4 cursor-pointer transition-all ${
                    role === 'buyer'
                      ? 'border-gray-800 bg-gray-50/50 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="role"
                      value="buyer"
                      checked={role === 'buyer'}
                      onChange={() => setRole('buyer')}
                      className="mt-0.5 accent-gray-900"
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Buyer</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Post demand, review matches, pay and confirm delivery.
                      </div>
                    </div>
                  </div>
                </label>

                {/* Supplier Card */}
                <label
                  className={`block border rounded-lg p-4 cursor-pointer transition-all ${
                    role === 'supplier'
                      ? 'border-gray-800 bg-gray-50/50 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="role"
                      value="supplier"
                      checked={role === 'supplier'}
                      onChange={() => setRole('supplier')}
                      className="mt-0.5 accent-gray-900"
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Supplier</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        List available supply, accept requests and fulfil orders.
                      </div>
                    </div>
                  </div>
                </label>

                {/* Logistics Card */}
                <label
                  className={`block border rounded-lg p-4 cursor-pointer transition-all ${
                    role === 'logistics'
                      ? 'border-gray-800 bg-gray-50/50 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="role"
                      value="logistics"
                      checked={role === 'logistics'}
                      onChange={() => setRole('logistics')}
                      className="mt-0.5 accent-gray-900"
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Logistics Provider</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Accept transport jobs, confirm pickup and delivery.
                      </div>
                    </div>
                  </div>
                </label>

                <p className="text-[11px] text-gray-400 pt-1 leading-relaxed">
                  Operations accounts are provisioned internally and do not appear here.
                </p>

                <button
                  type="submit"
                  className="w-full mt-4 bg-agri-700 hover:bg-agri-800 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors shadow-xs cursor-pointer"
                >
                  Continue
                </button>
              </form>

              <div className="mt-6 text-center text-xs text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-agri-700 hover:underline">
                  Log in
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Account Details</h2>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-gray-500 hover:text-gray-800 underline"
                >
                  Change role ({role})
                </button>
              </div>

              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Contact / Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kola Farms Ltd"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Company / Organization Name
                  </label>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="e.g. Kola Farms Ltd"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Location / State</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Ikeja, Lagos"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-agri-700 focus:border-agri-700 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-agri-700 hover:bg-agri-800 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors shadow-xs disabled:opacity-50"
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
