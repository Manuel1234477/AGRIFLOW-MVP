import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Bell, ChevronDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AgriFlowLogo } from '../ui/AgriFlowLogo';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import type { UserRole } from '../../types';

interface NavItem {
  label: string;
  path: string;
}

function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case 'buyer':
      return [
        { label: 'Dashboard', path: '/app/dashboard' },
        { label: 'Demands', path: '/app/demands' },
        { label: 'Matches', path: '/app/matches' },
        { label: 'Transactions', path: '/app/transactions' },
        { label: 'Deliveries', path: '/app/deliveries' },
      ];
    case 'supplier':
      return [
        { label: 'Dashboard', path: '/app/dashboard' },
        { label: 'My Supply', path: '/app/supply/manage' },
        { label: 'Requests', path: '/app/requests' },
        { label: 'Active Orders', path: '/app/transactions' },
        { label: 'Fulfilment', path: '/app/shipments' },
      ];
    case 'logistics':
      return [
        { label: 'Dashboard', path: '/app/dashboard' },
        { label: 'Assignments', path: '/app/jobs' },
        { label: 'Active Deliveries', path: '/app/shipments' },
        { label: 'History', path: '/app/deliveries' },
        { label: 'Incidents', path: '/app/incidents' },
      ];
    case 'admin':
      return [
        { label: 'Overview', path: '/app/dashboard' },
        { label: 'Users', path: '/app/admin/users' },
        { label: 'Transactions', path: '/app/admin/transactions' },
        { label: 'Logistics Jobs', path: '/app/admin/logistics' },
        { label: 'Disputes', path: '/app/admin/disputes' },
        { label: 'Audit Trail', path: '/app/admin/audit' },
      ];
  }
}

export function Navbar() {
  const { session, logout, unreadCount } = useApp();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!session) return null;

  const navItems = getNavItems(session.role);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const rolePillClass: Record<UserRole, string> = {
    buyer: '',
    supplier: 'bg-gray-100 text-gray-700 border border-gray-300',
    logistics: 'bg-gray-100 text-gray-700 border border-gray-300',
    admin: 'bg-gray-800 text-white',
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left: Brand */}
          <div className="flex items-center gap-2.5">
            <NavLink to="/app/dashboard" className="flex items-center group">
              <AgriFlowLogo size="sm" />
            </NavLink>

            {session.role !== 'buyer' && (
              <span className={`text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded uppercase ${rolePillClass[session.role]}`}>
                {session.role}
              </span>
            )}
          </div>

          {/* Center: Main Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-4">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                    isActive
                      ? 'text-gray-900 border-agri-700 font-semibold'
                      : 'text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-300'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right: Notifications & User Menu */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <NavLink
              to="/app/notifications"
              className="relative p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-agri-600" />
              )}
            </NavLink>


            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-semibold">
                  {session.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline-block max-w-[150px] truncate text-gray-800">
                  {session.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 animate-in fade-in">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-900 truncate">{session.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{session.email}</p>
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-agri-50 text-agri-700 font-medium capitalize">
                      {session.role} Account
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile nav scrollbar */}
      <div className="md:hidden flex overflow-x-auto px-4 py-2 border-t border-gray-100 gap-2 bg-gray-50/50">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
                isActive ? 'bg-agri-700 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </header>
  );
}
