import { EmptyState } from '../../components/ui/EmptyState';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { formatDateTime } from '../../utils/format';
import { Users } from 'lucide-react';
import type { User } from '../../types';

const ROLE_COLORS: Record<string, string> = {
  buyer: 'bg-blue-100 text-blue-700',
  supplier: 'bg-green-100 text-green-700',
  logistics: 'bg-violet-100 text-violet-700',
  admin: 'bg-gray-100 text-gray-700',
};

export function AdminUsersPage() {
  // The backend has no endpoint to list users yet (only auth/register,
  // auth/login, auth/me — see backend/README.md "Not built yet"), so this
  // page has nothing to show until one is added.
  const users: User[] = [];
  const sorted = [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (sorted.length === 0) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Users</h1>
        <EmptyState
          icon={<Users className="w-7 h-7" />}
          title="User directory not available"
          description="The backend doesn't expose a list-users endpoint yet — only registration, login and the current user's own profile. This page will populate once that endpoint exists."
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Users ({users.length})</h1>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">
                        {u.name[0]}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800 text-sm">{u.name}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${ROLE_COLORS[u.role]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{u.organizationName ?? '—'}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{u.location ?? '—'}</td>
                  <td className="px-5 py-3.5"><VerifiedBadge verified={u.verified} /></td>
                  <td className="px-5 py-3.5 text-xs text-gray-500">{formatDateTime(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
