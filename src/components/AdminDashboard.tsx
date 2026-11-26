import { FormEvent, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { PLATFORM_OWNER_CONFIG } from '../config/platform';
import {
  adminApproveClient,
  adminRejectClient,
  formatDateTime,
  formatInr,
  isAdminAuthenticated,
  setAdminAuthenticated,
} from '../lib/storage';
import { ClientAccount, ClientAccountStatus } from '../types';
import { ClientStatusLabel } from './StatusIndicator';

interface AdminDashboardProps {
  clients: ClientAccount[];
  onRefresh: () => void;
  onOpenGateway: (slug: string) => void;
}

export function AdminDashboard({
  clients,
  onRefresh,
  onOpenGateway,
}: AdminDashboardProps) {
  const [unlocked, setUnlocked] = useState(() => isAdminAuthenticated());
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [statusFilter, setStatusFilter] = useState<'ALL' | ClientAccountStatus>('ALL');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (passwordInput === PLATFORM_OWNER_CONFIG.adminPassword) {
      setAdminAuthenticated(true);
      setUnlocked(true);
      setAuthError('');
      setPasswordInput('');
    } else {
      setAuthError('Incorrect admin password.');
    }
  };

  const handleLock = () => {
    setAdminAuthenticated(false);
    setUnlocked(false);
  };

  const copyText = (key: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedId(key);
    setTimeout(() => setCopiedId((prev) => (prev === key ? '' : prev)), 1800);
  };

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((client) => {
      if (statusFilter !== 'ALL' && client.status !== statusFilter) return false;
      if (!q) return true;
      return (
        client.entityName.toLowerCase().includes(q) ||
        client.fullName.toLowerCase().includes(q) ||
        client.email.toLowerCase().includes(q) ||
        client.slug.toLowerCase().includes(q) ||
        (client.activationUtr || '').toLowerCase().includes(q) ||
        (client.gatewayConfig?.upiId || '').toLowerCase().includes(q)
      );
    });
  }, [clients, statusFilter, search]);

  const pendingCount = clients.filter((c) => c.status === 'PENDING_VERIFICATION').length;
  const activeCount = clients.filter((c) => c.status === 'ACTIVE').length;
  const totalRevenue = activeCount * PLATFORM_OWNER_CONFIG.lifetimeFeeInr;

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="font-display text-xl font-bold text-slate-900">
              Platform Owner Admin
            </h1>
            <p className="text-xs text-slate-500">
              Restricted to {PLATFORM_OWNER_CONFIG.payeeName} ({PLATFORM_OWNER_CONFIG.upiId}) to verify ₹499 lifetime payments and activate client gateways.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Admin Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Unlock Admin Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <ShieldCheck className="w-4 h-4" />
            Owner Console · {PLATFORM_OWNER_CONFIG.payeeName} ({PLATFORM_OWNER_CONFIG.upiId})
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 mt-1">
            Client Activation &amp; UTR Verification
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleLock}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Lock Admin Panel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Registered Clients</p>
          <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {clients.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Pending ₹499 Verifications</p>
          <p className="font-mono text-2xl font-bold text-amber-700 mt-1 tabular-nums">
            {pendingCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Active Gateways</p>
          <p className="font-mono text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {activeCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Verified Lifetime Revenue</p>
          <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatInr(totalRevenue)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/60 rounded-lg w-fit">
            {(
              [
                { id: 'ALL', label: 'All Clients' },
                { id: 'PENDING_VERIFICATION', label: `Pending (${pendingCount})` },
                { id: 'ACTIVE', label: 'Active' },
                { id: 'UNPAID', label: 'Unpaid' },
                { id: 'REJECTED', label: 'Rejected' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search business, email, or UTR..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>

        {filteredClients.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="font-display text-sm font-semibold text-slate-900">
              {clients.length === 0
                ? 'No clients registered yet'
                : 'No clients match your search'}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              When merchants sign up and submit their ₹499 FamPay UTR numbers, they will appear here for one-click activation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/40">
                  <th className="py-3 px-5">Entity / Merchant</th>
                  <th className="py-3 px-4">Owner &amp; Email</th>
                  <th className="py-3 px-4">Merchant UPI</th>
                  <th className="py-3 px-4">₹499 Activation UTR</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-slate-900">{client.entityName}</p>
                      <p className="font-mono text-[11px] text-slate-500 mt-0.5">
                        ?gateway={client.slug} · {client.id}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-900">{client.fullName}</p>
                      <p className="text-slate-500 mt-0.5">{client.email}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-800 whitespace-nowrap">
                      {client.gatewayConfig?.upiId || (
                        <span className="font-sans text-slate-400">Not configured</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {client.activationUtr ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => copyText(client.id, client.activationUtr!)}
                            className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900 hover:text-teal-700 cursor-pointer tabular-nums"
                          >
                            {client.activationUtr}
                            {copiedId === client.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                          {client.activationSubmittedAt && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {formatDateTime(client.activationSubmittedAt)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">Not submitted</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <ClientStatusLabel status={client.status} />
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {client.status !== 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => {
                              adminApproveClient(client.id);
                              onRefresh();
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve &amp; Activate
                          </button>
                        )}
                        {client.status === 'PENDING_VERIFICATION' && (
                          <button
                            type="button"
                            onClick={() => {
                              adminRejectClient(client.id);
                              onRefresh();
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        )}
                        {client.status === 'ACTIVE' && client.gatewayConfig && (
                          <button
                            type="button"
                            onClick={() => onOpenGateway(client.slug)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                          >
                            Open Gateway
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
