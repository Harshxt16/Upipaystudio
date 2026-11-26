import { FormEvent, useEffect, useMemo, useState } from 'react';
import { User, signInWithPopup } from 'firebase/auth';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  FlaskConical,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { PLATFORM_OWNER_CONFIG } from '../config/platform';
import {
  SAMPLE_FAMPAY_EMAILS,
  generateFamPayAppsScript,
  parseFamPayEmailText,
} from '../lib/fampaySync';
import { PLATFORM_ADMIN_EMAIL, auth, googleProvider } from '../lib/firebase';
import {
  adminApproveClient,
  adminRejectClient,
  formatDateTime,
  formatInr,
  ingestFamPayAlertFromAdmin,
  isAdminAuthenticated,
  saveFamPaySyncConfig,
  setAdminAuthenticated,
  subscribeAllClientsForAdmin,
  subscribeFamPayAlertsForAdmin,
  subscribeFamPaySyncConfig,
  subscribeUsedUtrsForAdmin,
} from '../lib/storage';
import {
  ClientAccount,
  ClientAccountStatus,
  FamPayAlertRecord,
  UsedUtrRecord,
} from '../types';
import { ClientStatusLabel } from './StatusIndicator';

interface AdminDashboardProps {
  authUser: User | null;
}

type AdminSectionTab = 'clients' | 'fampay_sync';

export function AdminDashboard({ authUser }: AdminDashboardProps) {
  const [unlocked, setUnlocked] = useState(() => isAdminAuthenticated());
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeSection, setActiveSection] = useState<AdminSectionTab>('clients');

  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [fampayAlerts, setFampayAlerts] = useState<FamPayAlertRecord[]>([]);
  const [usedUtrs, setUsedUtrs] = useState<UsedUtrRecord[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [statusFilter, setStatusFilter] = useState<'ALL' | ClientAccountStatus>('ALL');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState('');

  // FamPay Gmail Sync Config
  const [notificationEmail, setNotificationEmail] = useState(
    PLATFORM_OWNER_CONFIG.fampayNotificationEmail
  );
  const [vercelAppUrl, setVercelAppUrl] = useState(PLATFORM_OWNER_CONFIG.vercelAppUrl);
  const [syncSecretInput, setSyncSecretInput] = useState('');
  const [savingSyncConfig, setSavingSyncConfig] = useState(false);
  const [syncConfigMessage, setSyncConfigMessage] = useState('');

  // Test FamPay Alert Parser Simulator
  const [simSender, setSimSender] = useState(SAMPLE_FAMPAY_EMAILS.valid499.senderEmail);
  const [simSubject, setSimSubject] = useState(SAMPLE_FAMPAY_EMAILS.valid499.subject);
  const [simBody, setSimBody] = useState(SAMPLE_FAMPAY_EMAILS.valid499.body);
  const [simBusy, setSimBusy] = useState(false);
  const [simFeedback, setSimFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const isOwnerGoogleVerified =
    Boolean(authUser?.emailVerified) &&
    authUser?.email?.toLowerCase() === PLATFORM_ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (!unlocked || !isOwnerGoogleVerified) {
      setClients([]);
      setFampayAlerts([]);
      setUsedUtrs([]);
      return;
    }

    setLoadingClients(true);
    setSyncError('');

    const unsubClients = subscribeAllClientsForAdmin(
      (list) => {
        setClients(list);
        setLoadingClients(false);
      },
      (err) => {
        setSyncError(err.message);
        setLoadingClients(false);
      }
    );

    const unsubAlerts = subscribeFamPayAlertsForAdmin(
      (list) => setFampayAlerts(list),
      () => {
        // Handled cleanly if alerts collection is empty
      }
    );

    const unsubUsed = subscribeUsedUtrsForAdmin(
      (list) => setUsedUtrs(list),
      () => {
        // Handled cleanly
      }
    );

    const unsubConfig = subscribeFamPaySyncConfig(
      (cfg) => {
        if (cfg) {
          if (cfg.notificationEmail) setNotificationEmail(cfg.notificationEmail);
          if (cfg.vercelAppUrl) setVercelAppUrl(cfg.vercelAppUrl);
        }
      },
      () => {
        // Ignore initial empty settings doc
      }
    );

    return () => {
      unsubClients();
      unsubAlerts();
      unsubUsed();
      unsubConfig();
    };
  }, [unlocked, isOwnerGoogleVerified, refreshNonce]);

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

  const handleConnectOwnerGoogle = async () => {
    setAuthError('');
    setSyncError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user.email?.toLowerCase() !== PLATFORM_ADMIN_EMAIL.toLowerCase()) {
        setSyncError(
          `Signed in as ${cred.user.email}. Please select ${PLATFORM_ADMIN_EMAIL} to access Firestore Admin records.`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      if (!msg.includes('popup-closed-by-user')) {
        setSyncError(msg);
      }
    }
  };

  const extractReadableError = (err: unknown, fallback: string): string => {
    if (!(err instanceof Error)) return fallback;
    try {
      const parsed = JSON.parse(err.message);
      if (parsed && typeof parsed.error === 'string') {
        return parsed.error;
      }
    } catch {
      // Plain error message
    }
    return err.message || fallback;
  };

  const handleLock = () => {
    setAdminAuthenticated(false);
    setUnlocked(false);
  };

  const handleApprove = async (clientId: string) => {
    if (!isOwnerGoogleVerified) {
      setSyncError(
        `Please sign in with ${PLATFORM_ADMIN_EMAIL} first to approve client activations.`
      );
      return;
    }
    setActionBusyId(clientId);
    setSyncError('');
    try {
      await adminApproveClient(clientId);
    } catch (err) {
      setSyncError(extractReadableError(err, 'Failed to approve client.'));
    } finally {
      setActionBusyId(null);
    }
  };

  const handleReject = async (clientId: string) => {
    if (!isOwnerGoogleVerified) {
      setSyncError(
        `Please sign in with ${PLATFORM_ADMIN_EMAIL} first to reject client activations.`
      );
      return;
    }
    setActionBusyId(clientId);
    setSyncError('');
    try {
      await adminRejectClient(clientId);
    } catch (err) {
      setSyncError(extractReadableError(err, 'Failed to reject client.'));
    } finally {
      setActionBusyId(null);
    }
  };

  const handleSaveSyncConfig = async (e: FormEvent) => {
    e.preventDefault();
    setSyncConfigMessage('');
    setSyncError('');
    if (!isOwnerGoogleVerified) {
      setSyncError(
        `Please connect ${PLATFORM_ADMIN_EMAIL} first before saving FamPay Sync settings to Firestore.`
      );
      return;
    }
    setSavingSyncConfig(true);
    try {
      await saveFamPaySyncConfig({
        notificationEmail,
        vercelAppUrl,
      });
      setSyncConfigMessage('FamPay Gmail Sync settings saved to Firestore.');
    } catch (err) {
      setSyncError(extractReadableError(err, 'Failed to save sync configuration.'));
    } finally {
      setSavingSyncConfig(false);
    }
  };

  const parsedSimulation = useMemo(
    () =>
      parseFamPayEmailText({
        subject: simSubject,
        body: simBody,
        senderEmail: simSender,
      }),
    [simSubject, simBody, simSender]
  );

  const generatedAppsScript = useMemo(
    () =>
      generateFamPayAppsScript({
        vercelAppUrl,
        syncSecret: syncSecretInput,
        notificationEmail,
      }),
    [vercelAppUrl, syncSecretInput, notificationEmail]
  );

  const handleRunSimulatorSync = async () => {
    setSimFeedback(null);
    if (!isOwnerGoogleVerified) {
      setSimFeedback({
        type: 'error',
        text: `Please connect ${PLATFORM_ADMIN_EMAIL} first to write synced alerts into Firestore.`,
      });
      return;
    }
    if (!parsedSimulation.utr || !parsedSimulation.utrValidation?.valid) {
      setSimFeedback({
        type: 'error',
        text: parsedSimulation.diagnosticMessage || 'Valid alphanumeric UTR / Ref ID not found.',
      });
      return;
    }
    if (parsedSimulation.amount === null) {
      setSimFeedback({
        type: 'error',
        text: 'Could not extract a valid INR payment amount from the email text.',
      });
      return;
    }

    setSimBusy(true);
    try {
      const result = await ingestFamPayAlertFromAdmin({
        utr: parsedSimulation.utr,
        amount: parsedSimulation.amount,
        sender_email: simSender,
        raw_subject: simSubject,
      });
      setSimFeedback({
        type: result.matched ? 'success' : 'warning',
        text: result.message,
      });
    } catch (err) {
      setSimFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to process simulated FamPay alert.',
      });
    } finally {
      setSimBusy(false);
    }
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
        (client.merchantCode || '').toLowerCase().includes(q) ||
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
              Restricted to {PLATFORM_OWNER_CONFIG.payeeName} ({PLATFORM_OWNER_CONFIG.upiId}) to verify ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr} lifetime payments and activate client gateways.
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
            Client Activation &amp; FamPay UTR Verification
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setRefreshNonce((n) => n + 1)}
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

      {!isOwnerGoogleVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-sm font-bold text-amber-950">
              Verify Owner Google Session to Sync Cloud Database
            </h2>
            <p className="text-xs text-amber-900 leading-relaxed max-w-2xl">
              {authUser
                ? `Currently signed in as ${authUser.email}. Switch to ${PLATFORM_ADMIN_EMAIL} to load and approve client requests from Firestore.`
                : `Sign in with the owner Google account (${PLATFORM_ADMIN_EMAIL}) to load and approve client requests across all devices.`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleConnectOwnerGoogle}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
          >
            {authUser ? `Switch to ${PLATFORM_ADMIN_EMAIL}` : 'Connect Owner Google Account'}
          </button>
        </div>
      )}

      {syncError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700">
          {syncError}
        </div>
      )}

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Registered Clients</p>
          <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {clients.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">
            Pending ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr} Verifications
          </p>
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
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Locked Anti-Fraud UTRs</p>
          <p className="font-mono text-2xl font-bold text-teal-700 mt-1 tabular-nums">
            {usedUtrs.length}
          </p>
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveSection('clients')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSection === 'clients'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Clients &amp; Manual Fallback ({clients.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('fampay_sync')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSection === 'fampay_sync'
              ? 'bg-teal-700 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Mail className="w-4 h-4" />
          FamPay Gmail Sync ({fampayAlerts.length})
        </button>
      </div>

      {activeSection === 'clients' && (
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

          {loadingClients ? (
            <div className="p-12 text-center text-xs text-slate-500">
              Syncing client registrations from Firestore...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="font-display text-sm font-semibold text-slate-900">
                {clients.length === 0
                  ? 'No clients registered yet'
                  : 'No clients match your search'}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                When merchants sign up and submit their ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr} FamPay UTR numbers, they will appear here in real time for instant auto-match or manual approval.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/40">
                    <th className="py-3 px-5">Entity / Merchant</th>
                    <th className="py-3 px-4">Contact Email</th>
                    <th className="py-3 px-4">Merchant UPI &amp; Brand</th>
                    <th className="py-3 px-4">
                      ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr} Activation UTR
                    </th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredClients.map((client) => {
                    const busy = actionBusyId === client.id;
                    return (
                      <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5">
                          <p className="font-semibold text-slate-900">{client.entityName}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {client.fullName} · {client.merchantCode || client.id.slice(0, 8)}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => copyText(`email-${client.id}`, client.email)}
                            className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:text-teal-700 cursor-pointer"
                            title="Copy contact email"
                          >
                            {client.email}
                            {copiedId === `email-${client.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-800 whitespace-nowrap">
                          {client.gatewayConfig?.upiId ? (
                            <div>
                              <p>{client.gatewayConfig.upiId}</p>
                              <p className="font-sans text-[11px] text-slate-500 mt-0.5">
                                {client.gatewayConfig.payeeName}
                                {client.gatewayConfig.adminPin
                                  ? ` · PIN: ${client.gatewayConfig.adminPin}`
                                  : ''}
                              </p>
                            </div>
                          ) : (
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
                                disabled={busy}
                                onClick={() => handleApprove(client.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-md transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {busy ? 'Saving...' : 'Approve & Activate'}
                              </button>
                            )}
                            {client.status === 'PENDING_VERIFICATION' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleReject(client.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-60 rounded-md transition-colors cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSection === 'fampay_sync' && (
        <div className="space-y-6">
          {/* Starter Tier Scope Notice */}
          <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-700">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">
                Starter Tier Cloud Project Mode Active
              </p>
              <p className="leading-relaxed">
                This app is currently running on a Google-hosted Starter Tier Firebase project, so unattended server-side webhook pushes (<code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">/api/fampay-sync</code>) cannot write to Firestore without upgrading your Google Cloud project to enable IAM. Use the <strong>Test FamPay Alert Parser &amp; Live Sync</strong> simulator below while signed in as Admin to verify and auto-unlock client accounts in real time, and use Block A &amp; B when ready for automated Gmail webhook sync.
              </p>
            </div>
          </div>

          {/* Configurable Separate Notification Gmail Settings */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Separate FamPay Notification Gmail Configuration
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Configure the dedicated Gmail inbox that receives FamPay ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr} UPI credit notifications and generates your sync script.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md w-fit">
                <ShieldCheck className="w-3.5 h-3.5" />
                Exact ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr} Amount Lock Enabled
              </span>
            </div>

            <form onSubmit={handleSaveSyncConfig} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label
                  htmlFor="sync-gmail-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Separate Notification Gmail Address
                </label>
                <input
                  id="sync-gmail-input"
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder="dhirajxstream@gmail.com"
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label
                  htmlFor="sync-vercel-url"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Deployment Base URL (for Apps Script)
                </label>
                <input
                  id="sync-vercel-url"
                  type="url"
                  value={vercelAppUrl}
                  onChange={(e) => setVercelAppUrl(e.target.value)}
                  placeholder="https://upipaystudio.vercel.app"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label
                  htmlFor="sync-secret-preview"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  SYNC_SECRET Header Value (Script Preview Only)
                </label>
                <div className="flex gap-2">
                  <input
                    id="sync-secret-preview"
                    type="password"
                    value={syncSecretInput}
                    onChange={(e) => setSyncSecretInput(e.target.value)}
                    placeholder="Enter your SYNC_SECRET"
                    className="flex-1 px-3.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  />
                  <button
                    type="submit"
                    disabled={savingSyncConfig}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    {savingSyncConfig ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>

            {!isOwnerGoogleVerified && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
                <span>
                  Sign in with <strong>{PLATFORM_ADMIN_EMAIL}</strong> to save sync settings to Firestore (script preview below already updates live).
                </span>
                <button
                  type="button"
                  onClick={handleConnectOwnerGoogle}
                  className="px-3 py-1.5 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer whitespace-nowrap shrink-0"
                >
                  Connect Owner Google
                </button>
              </div>
            )}

            {syncConfigMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-700">
                {syncConfigMessage}
              </div>
            )}
          </div>

          {/* Two Separated Blocks: Block A (Code) & Block B (Guide + Simulator) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Block A — Copy-Paste Google Apps Script (Code) */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-teal-400" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-teal-300">
                      Block A
                    </p>
                    <h3 className="font-display text-sm font-bold">
                      Copy-Paste Google Apps Script (Code)
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => copyText('apps-script-code', generatedAppsScript)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-md cursor-pointer whitespace-nowrap"
                >
                  {copiedId === 'apps-script-code' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied Script
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Script
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 bg-slate-950 text-slate-200">
                <pre className="text-[11px] leading-relaxed font-mono overflow-x-auto max-h-[460px] whitespace-pre">
                  {generatedAppsScript}
                </pre>
              </div>
            </div>

            {/* Block B — Step-by-Step Setup Guide + Simulator */}
            <div className="lg:col-span-6 space-y-6">
              {/* Step-by-Step Guide */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                  <BookOpen className="w-4 h-4 text-teal-700" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                      Block B
                    </p>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Step-by-Step Setup Guide (Separate Notification Gmail)
                    </h3>
                  </div>
                </div>

                <ol className="space-y-3 text-xs text-slate-700 list-decimal pl-5 leading-relaxed">
                  <li>
                    Sign into your <strong>separate notification Gmail</strong> (
                    <span className="font-mono text-slate-900">
                      {notificationEmail || PLATFORM_OWNER_CONFIG.fampayNotificationEmail}
                    </span>
                    ) where FamPay sends payment credit alerts.
                  </li>
                  <li>
                    Open{' '}
                    <span className="font-mono font-semibold text-slate-900">
                      script.google.com
                    </span>{' '}
                    in that same Google account and click <strong>New project</strong>.
                  </li>
                  <li>
                    Replace the default <code className="font-mono">myFunction</code> code with the{' '}
                    <strong>Block A</strong> Google Apps Script and click <strong>Save</strong>.
                  </li>
                  <li>
                    Open <strong>Triggers</strong> (clock icon in left sidebar) →{' '}
                    <strong>Add Trigger</strong> → Function:{' '}
                    <code className="font-mono">syncFamPayAlertsToWebhook</code> → Event source:{' '}
                    <strong>Time-driven</strong> → Type: <strong>Minutes timer</strong> → Interval:{' '}
                    <strong>Every minute</strong>.
                  </li>
                  <li>
                    Click <strong>Run</strong> once to authorize Gmail &amp; URL Fetch scopes. Each matching email is automatically marked as read so it is never synced twice.
                  </li>
                </ol>
              </div>

              {/* Test FamPay Alert Parser Simulator */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-700" />
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Test FamPay Alert Parser &amp; Live Sync Simulator
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(SAMPLE_FAMPAY_EMAILS).map(([key, sample]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSimSender(sample.senderEmail);
                          setSimSubject(sample.subject);
                          setSimBody(sample.body);
                          setSimFeedback(null);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="sim-sender"
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Sender Email
                    </label>
                    <input
                      id="sim-sender"
                      type="text"
                      value={simSender}
                      onChange={(e) => setSimSender(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sim-subject"
                      className="block text-[11px] font-semibold text-slate-600 mb-1"
                    >
                      Email Subject
                    </label>
                    <input
                      id="sim-subject"
                      type="text"
                      value={simSubject}
                      onChange={(e) => setSimSubject(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="sim-body"
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Paste Real FamPay Notification Email Text
                  </label>
                  <textarea
                    id="sim-body"
                    rows={4}
                    value={simBody}
                    onChange={(e) => setSimBody(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  />
                </div>

                {/* Live Regex Diagnostic Strip */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <span>
                      Extracted Amount:{' '}
                      <strong className="font-mono text-slate-900">
                        {parsedSimulation.amount !== null ? `₹${parsedSimulation.amount}` : 'Not found'}
                      </strong>
                    </span>
                    <span>
                      UTR / Ref ID:{' '}
                      <strong className="font-mono text-slate-900">
                        {parsedSimulation.utr || 'Not found'}
                      </strong>
                    </span>
                    <span
                      className={`font-semibold ${
                        parsedSimulation.canAutoApprove ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {parsedSimulation.canAutoApprove
                        ? `Eligible for ₹${PLATFORM_OWNER_CONFIG.lifetimeFeeInr} Auto-Activation`
                        : `Blocked by Anti-Fraud / ₹${PLATFORM_OWNER_CONFIG.lifetimeFeeInr} Lock`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {parsedSimulation.diagnosticMessage}
                  </p>
                </div>

                {simFeedback && (
                  <div
                    className={`p-3 rounded-lg border text-xs font-medium flex items-start gap-2 ${
                      simFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : simFeedback.type === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {simFeedback.type === 'success' ? (
                      <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>{simFeedback.text}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={simBusy}
                  onClick={handleRunSimulatorSync}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {simBusy
                    ? 'Running Alert Sync & Auto-Match...'
                    : 'Sync Parsed Alert to Firestore & Run Auto-Match'}
                </button>
              </div>
            </div>
          </div>

          {/* Live Synced FamPay Alerts & Used UTRs Ledger */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-600" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Synced FamPay Alerts (`fampay_alerts`)
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {fampayAlerts.length} alerts · {usedUtrs.length} locked UTRs
              </span>
            </div>

            {fampayAlerts.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                No FamPay alerts synced yet. Use the Test FamPay Alert Parser simulator above to test end-to-end auto-activation.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/40">
                      <th className="py-3 px-5">UTR / Ref ID</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Sender</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Received</th>
                      <th className="py-3 px-5 text-right">Match Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {fampayAlerts.map((alert) => (
                      <tr key={alert.utr} className="hover:bg-slate-50/70">
                        <td className="py-3 px-5 font-mono font-semibold text-slate-900 tabular-nums">
                          {alert.utr}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                          {formatInr(alert.amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{alert.sender_email}</td>
                        <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                          {alert.raw_subject}
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {formatDateTime(alert.received_at)}
                        </td>
                        <td className="py-3 px-5 text-right whitespace-nowrap">
                          {alert.matched ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Matched &amp; Activated
                            </span>
                          ) : alert.amount === PLATFORM_OWNER_CONFIG.lifetimeFeeInr ? (
                            <span className="font-semibold text-amber-700">
                              Unmatched ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr} (Ready)
                            </span>
                          ) : (
                            <span className="font-semibold text-red-700">
                              Locked (Amount ≠ ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
