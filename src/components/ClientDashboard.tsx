import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardList,
  Code2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  LayoutDashboard,
  Lock,
  QrCode,
  Search,
  Settings2,
  Smartphone,
  Trash2,
  XCircle,
} from 'lucide-react';
import { BRAND_ACCENT_PRESETS, PLATFORM_OWNER_CONFIG } from '../config/platform';
import { generateWebsiteCheckoutScript } from '../lib/checkoutScriptGenerator';
import {
  buildGatewayUrl,
  buildUpiIntentUri,
  exportOrdersCsv,
  formatDateTime,
  formatInr,
  isValidOptionalUrl,
  isValidUpiId,
  isValidUtr,
  submitActivationUtr,
  updateClientGatewayConfig,
  updateOrderStatus,
} from '../lib/storage';
import { ClientAccount, CustomerOrder, OrderStatus } from '../types';
import { CheckoutSandbox } from './CheckoutSandbox';
import { QrCodeDisplay } from './QrCodeDisplay';
import { ClientStatusLabel, OrderStatusLabel } from './StatusIndicator';

type DashboardTab = 'setup' | 'activation' | 'gateway' | 'orders';
type IntegrationTab = 'code' | 'guide';
type ActivationPayStep =
  | 'choose'
  | 'qr'
  | 'upi_waiting'
  | 'upi_return'
  | 'not_confirmed';

interface ClientDashboardProps {
  client: ClientAccount;
  orders: CustomerOrder[];
  onOpenLiveGateway: (slug: string, amount?: number, orderId?: string) => void;
  onRefresh: () => void;
}

export function ClientDashboard({
  client,
  orders,
  onOpenLiveGateway,
  onRefresh,
}: ClientDashboardProps) {
  const initialTab: DashboardTab = useMemo(() => {
    if (!client.gatewayConfig) return 'setup';
    if (client.status !== 'ACTIVE') return 'activation';
    return 'gateway';
  }, [client.gatewayConfig, client.status]);

  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const [integrationTab, setIntegrationTab] = useState<IntegrationTab>('code');

  // Setup Wizard Form State
  const [upiId, setUpiId] = useState(client.gatewayConfig?.upiId || '');
  const [payeeName, setPayeeName] = useState(
    client.gatewayConfig?.payeeName || client.entityName
  );
  const [adminPin, setAdminPin] = useState(client.gatewayConfig?.adminPin || '');
  const [showSetupPin, setShowSetupPin] = useState(false);
  const [showGuidePin, setShowGuidePin] = useState(false);
  const [staticQrDataUrl, setStaticQrDataUrl] = useState<string | undefined>(
    client.gatewayConfig?.staticQrDataUrl
  );
  const [accentColor, setAccentColor] = useState(
    client.gatewayConfig?.accentColor || '#0F766E'
  );
  const [redirectUrl, setRedirectUrl] = useState(
    client.gatewayConfig?.redirectUrl || ''
  );
  const [setupError, setSetupError] = useState('');
  const [setupSavedMsg, setSetupSavedMsg] = useState('');

  // Activation Payment & UTR State
  const [activationPayStep, setActivationPayStep] = useState<ActivationPayStep>(
    client.status === 'PENDING_VERIFICATION' ? 'qr' : 'choose'
  );
  const [activationUtr, setActivationUtr] = useState(
    client.activationUtr && client.activationUtr !== 'UPI-APP-PAID' ? client.activationUtr : ''
  );
  const [activationAppUtr, setActivationAppUtr] = useState('');
  const [activationError, setActivationError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string>('');

  // Orders Filter State
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<'ALL' | OrderStatus>('ALL');

  const copyText = (key: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? '' : prev)), 1800);
  };

  const handleStaticQrUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setSetupError('QR image must be under 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setStaticQrDataUrl(reader.result);
        setSetupError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveGateway = (e: FormEvent) => {
    e.preventDefault();
    setSetupError('');
    setSetupSavedMsg('');

    if (!isValidUpiId(upiId)) {
      setSetupError('Please enter a valid UPI ID (e.g., store@fam or brand@okaxis).');
      return;
    }
    if (payeeName.trim().length < 2) {
      setSetupError('Please enter a Payee / Display Name.');
      return;
    }
    if (adminPin.trim().length < 4) {
      setSetupError('Please set a Secret Business Admin PIN / Password (minimum 4 characters).');
      return;
    }
    if (!isValidOptionalUrl(redirectUrl)) {
      setSetupError('Redirect URL must start with http:// or https://');
      return;
    }

    updateClientGatewayConfig(client.id, {
      upiId: upiId.trim(),
      payeeName: payeeName.trim(),
      adminPin: adminPin.trim(),
      staticQrDataUrl,
      accentColor,
      redirectUrl: redirectUrl.trim() || undefined,
    });
    onRefresh();

    if (client.status !== 'ACTIVE') {
      setSetupSavedMsg('Gateway details saved. Complete ₹499 activation to unlock your website script.');
      setActiveTab('activation');
    } else {
      setSetupSavedMsg('Gateway configuration updated.');
    }
  };

  const activationIntentUri = buildUpiIntentUri({
    pa: PLATFORM_OWNER_CONFIG.upiId,
    pn: PLATFORM_OWNER_CONFIG.payeeName,
    am: PLATFORM_OWNER_CONFIG.lifetimeFeeInr,
    tn: `LIFETIME_${client.id}`,
  });

  useEffect(() => {
    if (activeTab !== 'activation' || activationPayStep !== 'upi_waiting') return;
    const onReturn = () => {
      if (document.visibilityState === 'visible') {
        setActivationPayStep('upi_return');
      }
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [activeTab, activationPayStep]);

  const handleLaunchActivationUpiApp = () => {
    setActivationError('');
    setActivationPayStep('upi_waiting');
    try {
      window.location.href = activationIntentUri;
    } catch {
      // Ignore scheme block in desktop browser
    }
  };

  const handleActivationSubmit = (e: FormEvent) => {
    e.preventDefault();
    setActivationError('');
    const cleaned = activationUtr.replace(/\s+/g, '');
    if (!isValidUtr(cleaned)) {
      setActivationError('Enter a valid 12-digit numeric UPI UTR / Reference Number.');
      return;
    }
    submitActivationUtr(client.id, cleaned);
    onRefresh();
  };

  const handleActivationUpiAppConfirm = (e: FormEvent) => {
    e.preventDefault();
    setActivationError('');
    const cleaned = activationAppUtr.replace(/\s+/g, '');
    submitActivationUtr(client.id, isValidUtr(cleaned) ? cleaned : 'UPI-APP-PAID');
    onRefresh();
  };

  const baseGatewayUrl = buildGatewayUrl({ slug: client.slug });
  const effectiveAdminPin = client.gatewayConfig?.adminPin?.trim() || '123456';
  const hasCustomAdminPin = Boolean(client.gatewayConfig?.adminPin?.trim());

  const websiteCheckoutScript = useMemo(() => {
    if (!client.gatewayConfig) return '';
    return generateWebsiteCheckoutScript({
      slug: client.slug,
      upiId: client.gatewayConfig.upiId,
      entityName: client.entityName,
      brandColor: client.gatewayConfig.accentColor || '#0F766E',
      adminPin: effectiveAdminPin,
      redirectUrl: client.gatewayConfig.redirectUrl,
      staticQrDataUrl: client.gatewayConfig.staticQrDataUrl,
    });
  }, [client.slug, client.entityName, client.gatewayConfig, effectiveAdminPin]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      if (orderFilter !== 'ALL' && order.status !== orderFilter) return false;
      if (!q) return true;
      return (
        order.orderId.toLowerCase().includes(q) ||
        order.utr.toLowerCase().includes(q) ||
        (order.customerName || '').toLowerCase().includes(q) ||
        (order.customerNote || '').toLowerCase().includes(q)
      );
    });
  }, [orders, orderSearch, orderFilter]);

  const approvedOrders = orders.filter((o) => o.status === 'APPROVED');
  const pendingOrders = orders.filter((o) => o.status === 'PENDING_VERIFICATION');
  const approvedVolume = approvedOrders.reduce((sum, o) => sum + o.amount, 0);

  const navItems: { id: DashboardTab; label: string; icon: typeof Settings2; locked?: boolean }[] = [
    { id: 'setup', label: 'Gateway Setup', icon: Settings2 },
    { id: 'activation', label: 'Lifetime License (₹499)', icon: CreditCard },
    {
      id: 'gateway',
      label: 'Website Integration',
      icon: LayoutDashboard,
      locked: client.status !== 'ACTIVE',
    },
    { id: 'orders', label: `Incoming Orders (${orders.length})`, icon: ClipboardList },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <aside className="w-full lg:w-64 shrink-0 bg-white border border-slate-200 rounded-xl p-4 space-y-6">
          <div className="pb-4 border-b border-slate-200">
            <p className="font-display text-sm font-bold text-slate-900 truncate">
              {client.entityName}
            </p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{client.email}</p>
            <div className="mt-3">
              <ClientStatusLabel status={client.status} />
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.locked && <Lock className="w-3.5 h-3.5 opacity-60 shrink-0" />}
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span>Merchant ID</span>
              <span className="font-mono text-slate-900 font-medium">{client.id}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Gateway Slug</span>
              <span className="font-mono text-slate-900 font-medium truncate max-w-[120px]">
                {client.slug}
              </span>
            </div>
          </div>
        </aside>

        <section className="flex-1 min-w-0 w-full space-y-6">
          {activeTab === 'setup' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              <div className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900">
                    Gateway Setup Wizard
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Configure where customer UPI payments settle and how your checkout looks.
                  </p>
                </div>
                {client.gatewayConfig && (
                  <span className="text-xs font-medium text-emerald-700">
                    Configuration Saved
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveGateway} className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="merchant-upi"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Business / Personal UPI ID
                    </label>
                    <input
                      id="merchant-upi"
                      type="text"
                      required
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="yourstore@fam or merchant@okaxis"
                      className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      All customer payments go directly to this UPI VPA.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="payee-name"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Payee / Display Name
                    </label>
                    <input
                      id="payee-name"
                      type="text"
                      required
                      value={payeeName}
                      onChange={(e) => setPayeeName(e.target.value)}
                      placeholder="PixelCraft Digital Studio"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Shown inside the customer&apos;s UPI app and checkout page.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="client-admin-pin"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Secret Business Admin PIN / Password
                    </label>
                    <div className="relative">
                      <input
                        id="client-admin-pin"
                        type={showSetupPin ? 'text' : 'password'}
                        required
                        minLength={4}
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        placeholder="e.g. 482910 or StoreAdmin@26"
                        className="w-full pr-10 pl-3.5 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSetupPin((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        aria-label="Toggle PIN visibility"
                      >
                        {showSetupPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Used to access your hidden order-verification panel on your own website.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="redirect-url"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Post-Payment Redirect URL (Optional)
                    </label>
                    <input
                      id="redirect-url"
                      type="url"
                      value={redirectUrl}
                      onChange={(e) => setRedirectUrl(e.target.value)}
                      placeholder="https://yourstore.com/thank-you"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Shown to customers after submitting their payment UTR.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Brand Accent Color
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {BRAND_ACCENT_PRESETS.map((preset) => (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setAccentColor(preset.hex)}
                        title={preset.name}
                        className={`w-8 h-8 rounded-lg border transition-transform cursor-pointer flex items-center justify-center ${
                          accentColor.toLowerCase() === preset.hex.toLowerCase()
                            ? 'border-slate-900 scale-105 ring-2 ring-slate-900/20'
                            : 'border-slate-200 hover:scale-105'
                        }`}
                        style={{ backgroundColor: preset.hex }}
                      >
                        {accentColor.toLowerCase() === preset.hex.toLowerCase() && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </button>
                    ))}
                    <input
                      type="color"
                      aria-label="Custom brand color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer bg-white p-0.5"
                    />
                    <span className="font-mono text-xs text-slate-600 uppercase">
                      {accentColor}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    QR Code Mode (Optional Static QR Image Upload)
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors whitespace-nowrap w-fit">
                      <ImagePlus className="w-4 h-4" />
                      {staticQrDataUrl ? 'Replace Static QR Image' : 'Upload Static QR Image'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleStaticQrUpload}
                        className="hidden"
                      />
                    </label>

                    {staticQrDataUrl ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={staticQrDataUrl}
                          alt="Uploaded static UPI QR"
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 object-contain border border-slate-200 rounded-md bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setStaticQrDataUrl(undefined)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Use Dynamic QR Instead
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Default: Programmatic Dynamic QR codes generated with exact amount &amp; Order ID.
                      </p>
                    )}
                  </div>
                </div>

                {setupError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
                    {setupError}
                  </div>
                )}

                {setupSavedMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-700">
                    {setupSavedMsg}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {client.gatewayConfig ? 'Save Configuration' : 'Save & Continue to Activation'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'activation' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              {client.status === 'ACTIVE' ? (
                <div className="space-y-6">
                  <div className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h1 className="font-display text-xl font-bold text-slate-900">
                        Lifetime Gateway License Active
                      </h1>
                      <p className="text-sm text-slate-500 mt-1">
                        Your ₹499 lifetime payment has been verified by {PLATFORM_OWNER_CONFIG.payeeName}.
                      </p>
                    </div>
                    <ClientStatusLabel status={client.status} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs text-slate-500">Submitted UTR</p>
                      <p className="font-mono text-sm font-semibold text-slate-900 mt-1 tabular-nums">
                        {client.activationUtr || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Activated On</p>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        {client.activatedAt ? formatDateTime(client.activatedAt) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Plan</p>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        ₹499 Lifetime (0% Fee)
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('gateway')}
                      className="px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Open Website Integration Studio
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h1 className="font-display text-xl font-bold text-slate-900">
                        ₹499 Lifetime Gateway Activation
                      </h1>
                      <p className="text-sm text-slate-500 mt-1">
                        Pay a one-time ₹499 fee to unlock your live shareable payment link and embed code.
                      </p>
                    </div>
                    <ClientStatusLabel status={client.status} />
                  </div>

                  {!client.gatewayConfig && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs font-medium text-amber-800">
                        Please configure your merchant UPI ID in Gateway Setup before or right after activating.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('setup')}
                        className="text-xs font-semibold text-amber-900 underline underline-offset-4 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Go to Gateway Setup
                      </button>
                    </div>
                  )}

                  {client.status === 'REJECTED' && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                      <p className="font-semibold">Previous UTR Submission Rejected</p>
                      <p className="mt-1">
                        {client.rejectedReason || 'Please verify your 12-digit UTR in your UPI app and resubmit.'}
                      </p>
                    </div>
                  )}

                  {client.status === 'PENDING_VERIFICATION' ? (
                    <div className="space-y-6">
                      <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                        <h2 className="font-display text-base font-bold text-slate-900">
                          Verification In Progress
                        </h2>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          Your reference <span className="font-mono font-semibold text-slate-900">{client.activationUtr}</span> was submitted on{' '}
                          {client.activationSubmittedAt
                            ? formatDateTime(client.activationSubmittedAt)
                            : 'just now'}
                          . Note: Verification may take up to <strong>24 hours</strong>—once {PLATFORM_OWNER_CONFIG.payeeName} verifies the ₹499 FamPay transaction in the Owner Admin Panel, your gateway activates immediately.
                        </p>
                      </div>

                      <form onSubmit={handleActivationSubmit} className="max-w-md space-y-4">
                        <div>
                          <label
                            htmlFor="activation-utr"
                            className="block text-xs font-semibold text-slate-700 mb-1.5"
                          >
                            Update 12-Digit UPI UTR / Reference Number (Optional)
                          </label>
                          <input
                            id="activation-utr"
                            type="text"
                            inputMode="numeric"
                            maxLength={12}
                            required
                            value={activationUtr}
                            onChange={(e) =>
                              setActivationUtr(e.target.value.replace(/\D/g, '').slice(0, 12))
                            }
                            placeholder="412345678901"
                            className="w-full px-3.5 py-2.5 text-base font-mono tracking-wider bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 tabular-nums"
                          />
                        </div>

                        {activationError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
                            {activationError}
                          </div>
                        )}

                        <button
                          type="submit"
                          className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Update Submitted UTR
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="max-w-2xl space-y-6">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div>
                          <p className="text-xs font-semibold text-slate-600">
                            One-Time Lifetime Fee
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Payee: {PLATFORM_OWNER_CONFIG.payeeName} · UPI:{' '}
                            <span className="font-mono text-slate-800">{PLATFORM_OWNER_CONFIG.upiId}</span>
                          </p>
                        </div>
                        <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                          ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr}
                        </span>
                      </div>

                      {activationPayStep === 'choose' && (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-slate-700">
                            Choose how you would like to pay ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr}:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                              type="button"
                              onClick={() => {
                                setActivationError('');
                                setActivationPayStep('qr');
                              }}
                              className="text-left p-5 bg-white border border-slate-200 hover:border-slate-900 rounded-xl transition-colors cursor-pointer flex items-start gap-3.5"
                            >
                              <QrCode className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-bold text-slate-900">Pay through QR Code</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  Scan QR code &amp; enter 12-digit UTR (verification may take up to 24 hrs)
                                </p>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={handleLaunchActivationUpiApp}
                              className="text-left p-5 bg-white border border-slate-200 hover:border-slate-900 rounded-xl transition-colors cursor-pointer flex items-start gap-3.5"
                            >
                              <Smartphone className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-bold text-slate-900">Pay through UPI App</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  Open GPay, PhonePe, Paytm, or FamPay directly on your phone
                                </p>
                              </div>
                            </button>
                          </div>
                        </div>
                      )}

                      {activationPayStep === 'qr' && (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                          <div className="md:col-span-5 flex flex-col items-center p-5 bg-slate-50 border border-slate-200 rounded-xl">
                            <QrCodeDisplay
                              value={activationIntentUri}
                              size={190}
                              accentColor="#0F766E"
                              label={`Scan with any UPI App · ₹${PLATFORM_OWNER_CONFIG.lifetimeFeeInr}`}
                            />
                            <div className="w-full mt-4 pt-3 border-t border-slate-200 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">FamPay UPI ID</span>
                                <button
                                  type="button"
                                  onClick={() => copyText('owner-upi', PLATFORM_OWNER_CONFIG.upiId)}
                                  className="inline-flex items-center gap-1 font-mono font-medium text-slate-900 hover:text-teal-700 cursor-pointer"
                                >
                                  {PLATFORM_OWNER_CONFIG.upiId}
                                  {copiedKey === 'owner-upi' ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-slate-400" />
                                  )}
                                </button>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">Reference</span>
                                <span className="font-mono text-slate-900">LIFETIME_{client.id}</span>
                              </div>
                            </div>
                          </div>

                          <div className="md:col-span-7 space-y-4">
                            <button
                              type="button"
                              onClick={() => setActivationPayStep('choose')}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                              Change Payment Method
                            </button>

                            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                              <strong>Note:</strong> After paying ₹499 via QR, enter your 12-digit UTR number below. Verification may take up to <strong>24 hours</strong>.
                            </div>

                            <form onSubmit={handleActivationSubmit} className="space-y-4">
                              <div>
                                <label
                                  htmlFor="activation-utr"
                                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                                >
                                  12-Digit UPI UTR / Reference Number
                                </label>
                                <input
                                  id="activation-utr"
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={12}
                                  required
                                  value={activationUtr}
                                  onChange={(e) =>
                                    setActivationUtr(e.target.value.replace(/\D/g, '').slice(0, 12))
                                  }
                                  placeholder="412345678901"
                                  className="w-full px-3.5 py-2.5 text-base font-mono tracking-wider bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 tabular-nums"
                                />
                              </div>

                              {activationError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
                                  {activationError}
                                </div>
                              )}

                              <button
                                type="submit"
                                className="w-full px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Submit UTR for Verification
                              </button>
                            </form>
                          </div>
                        </div>
                      )}

                      {activationPayStep === 'upi_waiting' && (
                        <div className="space-y-4 max-w-md">
                          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <p className="text-sm font-bold text-slate-900">Opening your UPI app...</p>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Complete the ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr} payment in your UPI app and return to this page. If your UPI app did not open automatically, tap below.
                            </p>
                          </div>

                          <a
                            href={activationIntentUri}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                          >
                            <Smartphone className="w-4 h-4" />
                            Open UPI App Again
                          </a>

                          <button
                            type="button"
                            onClick={() => setActivationPayStep('upi_return')}
                            className="w-full py-2.5 px-4 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                          >
                            I Returned From UPI App
                          </button>

                          <button
                            type="button"
                            onClick={() => setActivationPayStep('not_confirmed')}
                            className="w-full py-2.5 px-4 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer"
                          >
                            Cancel / Payment Not Done
                          </button>
                        </div>
                      )}

                      {activationPayStep === 'upi_return' && (
                        <div className="space-y-4 max-w-md">
                          <div className="space-y-1">
                            <h2 className="font-display text-base font-bold text-slate-900">
                              Did you complete the ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr} payment in your UPI app?
                            </h2>
                            <p className="text-xs text-slate-500">
                              Confirm your payment status to submit your lifetime activation request.
                            </p>
                          </div>

                          <form onSubmit={handleActivationUpiAppConfirm} className="space-y-3">
                            <div>
                              <label
                                htmlFor="activation-app-utr"
                                className="block text-xs font-semibold text-slate-700 mb-1.5"
                              >
                                12-Digit UTR (Optional if paid via UPI app)
                              </label>
                              <input
                                id="activation-app-utr"
                                type="text"
                                inputMode="numeric"
                                maxLength={12}
                                value={activationAppUtr}
                                onChange={(e) =>
                                  setActivationAppUtr(e.target.value.replace(/\D/g, '').slice(0, 12))
                                }
                                placeholder="Optional 12-digit UTR"
                                className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 tabular-nums"
                              />
                            </div>
                            <button
                              type="submit"
                              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                            >
                              Yes, Payment Completed
                            </button>
                          </form>

                          <button
                            type="button"
                            onClick={() => setActivationPayStep('not_confirmed')}
                            className="w-full py-2.5 px-4 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer"
                          >
                            No, Payment Not Done
                          </button>
                        </div>
                      )}

                      {activationPayStep === 'not_confirmed' && (
                        <div className="space-y-4 max-w-md">
                          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-xs text-red-800">
                            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <p className="leading-relaxed">
                              Payment was not completed in your UPI app, so your ₹499 lifetime order is <strong>not confirmed</strong>.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={handleLaunchActivationUpiApp}
                            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                          >
                            Retry via UPI App
                          </button>

                          <button
                            type="button"
                            onClick={() => setActivationPayStep('qr')}
                            className="w-full py-2.5 px-4 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                          >
                            Pay through QR Code Instead
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'gateway' && (
            <div className="space-y-6">
              {client.status !== 'ACTIVE' ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
                  <Lock className="w-8 h-8 text-slate-400 mx-auto" />
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Gateway Link Locked Until Activation
                  </h2>
                  <p className="text-sm text-slate-600 max-w-md mx-auto">
                    Complete the one-time ₹499 lifetime payment and admin verification to unlock your shareable checkout link and embed snippets.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('activation')}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Go to ₹499 Activation
                  </button>
                </div>
              ) : !client.gatewayConfig ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
                  <Settings2 className="w-8 h-8 text-slate-400 mx-auto" />
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Finish Configuring Your UPI ID
                  </h2>
                  <p className="text-sm text-slate-600 max-w-md mx-auto">
                    Your account is active! Add your merchant UPI ID and display name in Gateway Setup to generate your live checkout page.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('setup')}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Configure UPI Details
                  </button>
                </div>
              ) : (
                <>
                  {!hasCustomAdminPin && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs font-medium text-amber-900">
                        You have not set a custom Secret Business Admin PIN yet (currently defaulting to <span className="font-mono font-bold">123456</span>). Set your own PIN in Gateway Setup before pasting this script on your website.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('setup')}
                        className="text-xs font-semibold text-amber-900 underline underline-offset-4 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Set Admin PIN
                      </button>
                    </div>
                  )}

                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h1 className="font-display text-lg font-bold text-slate-900">
                          Hosted Direct Checkout Link
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Share this standalone checkout link anytime, or integrate the website script below into your own site.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenLiveGateway(client.slug)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Open Hosted Checkout
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <input
                        type="text"
                        readOnly
                        value={baseGatewayUrl}
                        aria-label="Shareable gateway URL"
                        className="flex-1 px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => copyText('base-url', baseGatewayUrl)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {copiedKey === 'base-url' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Copied URL
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy URL
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="font-display text-xl font-bold text-slate-900">
                          Website Checkout Integration
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          Switch between your pre-configured website script and the step-by-step setup guide.
                        </p>
                      </div>

                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setIntegrationTab('code')}
                          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                            integrationTab === 'code'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Code2 className="w-3.5 h-3.5" />
                          [CODE] Checkout Script
                        </button>
                        <button
                          type="button"
                          onClick={() => setIntegrationTab('guide')}
                          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                            integrationTab === 'guide'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          [GUIDE] Integration Steps
                        </button>
                      </div>
                    </div>

                    {integrationTab === 'code' ? (
                      <div className="p-6 sm:p-8 space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h3 className="font-display text-base font-bold text-slate-900">
                              [CODE] Copy-Paste Website Checkout Script
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                              Self-contained HTML/JS snippet pre-filled with your UPI ID, Entity Name, Brand Color, and Secret Business Admin PIN.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => copyText('full-script', websiteCheckoutScript)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                          >
                            {copiedKey === 'full-script' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                Script Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy Complete Script
                              </>
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                          <div>
                            <p className="text-slate-500">UPI_ID</p>
                            <p className="font-mono font-semibold text-slate-900 mt-0.5 truncate">
                              {client.gatewayConfig.upiId}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">ENTITY_NAME</p>
                            <p className="font-semibold text-slate-900 mt-0.5 truncate">
                              {client.entityName}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">BRAND_COLOR</p>
                            <p className="font-mono font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                              <span
                                className="inline-block w-3 h-3 rounded-xs border border-slate-300"
                                style={{ backgroundColor: client.gatewayConfig.accentColor }}
                              />
                              {client.gatewayConfig.accentColor}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 flex items-center justify-between">
                              <span>CLIENT_ADMIN_PIN</span>
                              <button
                                type="button"
                                onClick={() => setShowGuidePin((s) => !s)}
                                className="text-slate-500 hover:text-slate-900 cursor-pointer"
                                aria-label="Toggle CLIENT_ADMIN_PIN"
                              >
                                {showGuidePin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </p>
                            <p className="font-mono font-semibold text-slate-900 mt-0.5">
                              {showGuidePin ? effectiveAdminPin : '••••••••'}
                            </p>
                          </div>
                        </div>

                        <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-96 leading-relaxed">
                          {websiteCheckoutScript}
                        </pre>

                        <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
                          <span>Paste this right before your website&apos;s closing &lt;/body&gt; tag.</span>
                          <button
                            type="button"
                            onClick={() => setIntegrationTab('guide')}
                            className="font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-4 cursor-pointer whitespace-nowrap"
                          >
                            Read Step-by-Step Guide →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 sm:p-8 space-y-8">
                        <div>
                          <h3 className="font-display text-base font-bold text-slate-900">
                            [GUIDE] Step-by-Step Website Integration Guide
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            Follow these three steps to connect UPIPay Studio to any website or storefront without writing backend code.
                          </p>
                        </div>

                        <div className="space-y-6">
                          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <p className="font-mono text-xs font-semibold text-teal-700">
                              Step 1 — Add the Script
                            </p>
                            <h4 className="font-display text-sm font-bold text-slate-900">
                              Paste the script before your closing &lt;/body&gt; tag
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Switch to the <button type="button" onClick={() => setIntegrationTab('code')} className="font-semibold text-teal-700 underline underline-offset-2 cursor-pointer">[CODE] Checkout Script</button> tab, click <strong>Copy Complete Script</strong>, and paste it right above the closing <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-800">&lt;/body&gt;</code> tag in your website HTML (or inside Shopify <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded">theme.liquid</code>, WordPress footer scripts, or Webflow Footer Code).
                            </p>
                          </div>

                          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <p className="font-mono text-xs font-semibold text-teal-700">
                              Step 2 — Connect Your Checkout Button &amp; Price
                            </p>
                            <h4 className="font-display text-sm font-bold text-slate-900">
                              Tag your final payable price and checkout button
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Add <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-800">id=&quot;checkout-total&quot;</code> (or <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-800">data-cart-total</code>) to your final price element and <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-800">id=&quot;final-checkout-btn&quot;</code> (or <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-800">data-upipay-checkout</code>) to your Pay/Checkout button. When clicked, the script strips <code className="bg-white border border-slate-200 px-1 rounded">₹</code> and commas, generates an Order ID, and opens your QR modal automatically.
                            </p>
                            <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto">
{`<p>Total Payable: <span id="checkout-total">₹1,499</span></p>
<button id="final-checkout-btn" type="button">Pay Now</button>`}
                            </pre>
                          </div>

                          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <p className="font-mono text-xs font-semibold text-teal-700">
                              Step 3 — How to Access Your Hidden Business Admin Login
                            </p>
                            <h4 className="font-display text-sm font-bold text-slate-900">
                              Private order verification invisible to regular shoppers
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              No public admin button or link is ever displayed on your storefront. Only you can open your hidden Order Verification Panel using either of these secret triggers, followed by your private PIN:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 text-xs">
                              <div className="p-3.5 bg-white border border-slate-200 rounded-lg">
                                <p className="text-slate-500">Secret URL Parameter</p>
                                <p className="font-mono font-semibold text-slate-900 mt-1 break-all">
                                  theirwebsite.com/?upipay_admin=true
                                </p>
                              </div>
                              <div className="p-3.5 bg-white border border-slate-200 rounded-lg">
                                <p className="text-slate-500">Secret Keyboard Shortcut</p>
                                <p className="font-mono font-semibold text-slate-900 mt-1">
                                  Ctrl + Shift + A
                                </p>
                              </div>
                              <div className="p-3.5 bg-white border border-slate-200 rounded-lg">
                                <p className="text-slate-500 flex items-center justify-between">
                                  <span>Your Business Admin PIN</span>
                                  <button
                                    type="button"
                                    onClick={() => setShowGuidePin((s) => !s)}
                                    className="text-slate-500 hover:text-slate-900 cursor-pointer"
                                    aria-label="Toggle Business Admin PIN"
                                  >
                                    {showGuidePin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                </p>
                                <div className="mt-1 flex items-center justify-between gap-2">
                                  <span className="font-mono font-semibold text-slate-900">
                                    {showGuidePin ? effectiveAdminPin : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyText('guide-pin', effectiveAdminPin)}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                                  >
                                    <KeyRound className="w-3 h-3" />
                                    {copiedKey === 'guide-pin' ? 'Copied' : 'Copy'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <CheckoutSandbox
                    client={client}
                    orders={orders}
                    effectiveAdminPin={effectiveAdminPin}
                    onRefresh={onRefresh}
                  />
                </>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Approved Revenue</p>
                  <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {formatInr(approvedVolume)}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Pending UTR Verification</p>
                  <p className="font-mono text-2xl font-bold text-amber-700 mt-1 tabular-nums">
                    {pendingOrders.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500">Approved Orders</p>
                  <p className="font-mono text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                    {approvedOrders.length}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Incoming Customer Orders
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Match submitted 12-digit UTRs against your UPI app history before approving.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {orders.length > 0 && (
                      <button
                        type="button"
                        onClick={() => exportOrdersCsv(orders, client.entityName)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-lg w-fit">
                    {(
                      [
                        { id: 'ALL', label: 'All' },
                        { id: 'PENDING_VERIFICATION', label: 'Pending' },
                        { id: 'APPROVED', label: 'Approved' },
                        { id: 'REJECTED', label: 'Rejected' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setOrderFilter(f.id)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          orderFilter === f.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Search Order ID or UTR..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <p className="font-display text-sm font-semibold text-slate-900">
                      {orders.length === 0
                        ? 'No incoming orders yet'
                        : 'No orders match your current filter'}
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {orders.length === 0
                        ? 'When customers pay on your live gateway and submit their 12-digit UTR, orders will appear here for approval.'
                        : 'Try clearing the search query or switching the status tab.'}
                    </p>
                    {orders.length === 0 && client.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => onOpenLiveGateway(client.slug, 999, 'ORD101')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        Preview Live Gateway
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/40">
                          <th className="py-3 px-5">Order ID</th>
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4 text-right">Amount</th>
                          <th className="py-3 px-4">12-Digit UTR</th>
                          <th className="py-3 px-4">Submitted</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {filteredOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                              {order.orderId}
                            </td>
                            <td className="py-3 px-4 text-slate-600 max-w-[180px] truncate">
                              {order.customerName || 'Guest Customer'}
                              {order.customerNote ? ` · ${order.customerNote}` : ''}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                              {formatInr(order.amount)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-800 tabular-nums whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => copyText(`utr-${order.id}`, order.utr)}
                                className="inline-flex items-center gap-1.5 hover:text-teal-700 cursor-pointer"
                                title="Copy UTR"
                              >
                                {order.utr}
                                {copiedKey === `utr-${order.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400" />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap tabular-nums">
                              {formatDateTime(order.createdAt)}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <OrderStatusLabel status={order.status} />
                            </td>
                            <td className="py-3 px-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                {order.status !== 'APPROVED' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateOrderStatus(order.id, 'APPROVED');
                                      onRefresh();
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Approve
                                  </button>
                                )}
                                {order.status !== 'REJECTED' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateOrderStatus(order.id, 'REJECTED');
                                      onRefresh();
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md cursor-pointer"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    Reject
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
          )}
        </section>
      </div>
    </div>
  );
}
