import { useState, useEffect } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { formatDateTime } from '../../utils/format';
import { Users, Search, Check, X, Loader2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../components/ui/Toast';
import type { User, UserRole } from '../../types';

const ROLE_COLORS: Record<string, string> = {
  buyer: 'bg-blue-100 text-blue-700',
  supplier: 'bg-green-100 text-green-700',
  logistics: 'bg-violet-100 text-violet-700',
  admin: 'bg-gray-100 text-gray-700',
};

export function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<Omit<User, 'passwordHash'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await adminService.fetchUsers({
        role: roleFilter !== 'all' ? (roleFilter as UserRole) : undefined,
        search: search || undefined,
        limit: 100,
      });
      setUsers(res.users);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter, search]);

  const handleToggleVerify = async (u: Omit<User, 'passwordHash'>) => {
    setUpdatingId(u.id);
    try {
      const updated = await adminService.verifyUser(u.id, !u.verified);
      setUsers((prev) => prev.map((item) => (item.id === u.id ? { ...item, verified: updated.verified } : item)));
      toast('success', `${u.name} is now ${updated.verified ? 'verified' : 'unverified'}.`);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Failed to update verification status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const sorted = [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">View registered accounts and manage platform verifications</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:border-gray-900"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:border-gray-900"
          >
            <option value="all">All Roles</option>
            <option value="buyer">Buyers</option>
            <option value="supplier">Suppliers</option>
            <option value="logistics">Logistics</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      {loading && sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-2" />
          <p className="text-sm">Loading users...</p>
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<Users className="w-7 h-7" />}
          title="No users found"
          description={search || roleFilter !== 'all' ? 'Try adjusting your search or filters.' : 'No users registered on the platform yet.'}
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-left">User</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-left">Role</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-left">Organisation</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-left">Location</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-left">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-left">Registered</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">
                          {u.name[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800 text-sm">{u.name}</div>
                          <div className="text-xs text-gray-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-700'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">{u.organizationName ?? '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">{u.location ?? '—'}</td>
                    <td className="px-5 py-3.5"><VerifiedBadge verified={u.verified} /></td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{formatDateTime(u.createdAt)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        disabled={updatingId === u.id}
                        onClick={() => handleToggleVerify(u)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          u.verified
                            ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {updatingId === u.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : u.verified ? (
                          <>
                            <X className="w-3 h-3" /> Unverify
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3" /> Verify
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

