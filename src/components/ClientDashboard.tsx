import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardList,
  Code2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  ImagePlus,
  LayoutDashboard,
  Lock,
  Search,
  Settings2,
  Smartphone,
  Trash2,
  XCircle,
} from 'lucide-react';
import { BRAND_ACCENT_PRESETS, PLATFORM_OWNER_CONFIG } from '../config/platform';
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
import { QrCodeDisplay } from './QrCodeDisplay';
import { ClientStatusLabel, OrderStatusLabel } from './StatusIndicator';

type DashboardTab = 'setup' | 'activation' | 'gateway' | 'orders';

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

  // Setup Wizard Form State
  const [upiId, setUpiId] = useState(client.gatewayConfig?.upiId || '');
  const [payeeName, setPayeeName] = useState(
    client.gatewayConfig?.payeeName || client.entityName
  );
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

  // Activation UTR State
  const [activationUtr, setActivationUtr] = useState(client.activationUtr || '');
  const [activationError, setActivationError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string>('');

  // Link Builder State
  const [customAmount, setCustomAmount] = useState('999');
  const [customOrderId, setCustomOrderId] = useState('ORD123');

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
    if (!isValidOptionalUrl(redirectUrl)) {
      setSetupError('Redirect URL must start with http:// or https://');
      return;
    }

    updateClientGatewayConfig(client.id, {
      upiId: upiId.trim(),
      payeeName: payeeName.trim(),
      staticQrDataUrl,
      accentColor,
      redirectUrl: redirectUrl.trim() || undefined,
    });
    onRefresh();

    if (client.status !== 'ACTIVE') {
      setSetupSavedMsg('Gateway details saved. Complete ₹499 activation to unlock your live link.');
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

  const baseGatewayUrl = buildGatewayUrl({ slug: client.slug });
  const parsedBuilderAmount = Number(customAmount);
  const customGatewayUrl = buildGatewayUrl({
    slug: client.slug,
    amount: !Number.isNaN(parsedBuilderAmount) && parsedBuilderAmount > 0 ? parsedBuilderAmount : undefined,
    orderId: customOrderId.trim() || undefined,
  });

  const previewMerchantIntent = client.gatewayConfig
    ? buildUpiIntentUri({
        pa: client.gatewayConfig.upiId,
        pn: client.gatewayConfig.payeeName,
        am: !Number.isNaN(parsedBuilderAmount) && parsedBuilderAmount > 0 ? parsedBuilderAmount : undefined,
        tn: customOrderId.trim() || undefined,
      })
    : '';

  const iframeEmbedSnippet = `<iframe src="${baseGatewayUrl}&embed=1" width="100%" height="680" style="border:1px solid #e2e8f0;border-radius:12px;" title="${client.entityName} UPI Checkout"></iframe>`;
  const buttonEmbedSnippet = `<a href="${customGatewayUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;background:${client.gatewayConfig?.accentColor || '#0F766E'};color:#ffffff;font-family:sans-serif;font-weight:600;text-decoration:none;border-radius:8px;">Pay via UPI</a>`;

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
      label: 'Share & Embed',
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
                      Open Share &amp; Embed Studio
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

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-5 flex flex-col items-center p-6 bg-slate-50 border border-slate-200 rounded-xl">
                      <QrCodeDisplay
                        value={activationIntentUri}
                        size={200}
                        accentColor="#0F766E"
                        label={`Scan with any UPI App · ₹${PLATFORM_OWNER_CONFIG.lifetimeFeeInr}`}
                      />

                      <a
                        href={activationIntentUri}
                        className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Smartphone className="w-4 h-4" />
                        Pay ₹499 via UPI App
                      </a>

                      <div className="w-full mt-4 pt-4 border-t border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500">Payee</span>
                          <span className="font-semibold text-slate-900">
                            {PLATFORM_OWNER_CONFIG.payeeName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500">FamPay UPI ID</span>
                          <button
                            type="button"
                            onClick={() => copyText('owner-upi', PLATFORM_OWNER_CONFIG.upiId)}
                            className="inline-flex items-center gap-1.5 font-mono font-medium text-slate-900 hover:text-teal-700 cursor-pointer"
                          >
                            {PLATFORM_OWNER_CONFIG.upiId}
                            {copiedKey === 'owner-upi' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500">Reference Note</span>
                          <span className="font-mono text-slate-900">LIFETIME_{client.id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-7 space-y-5">
                      {client.status === 'PENDING_VERIFICATION' ? (
                        <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                          <h2 className="font-display text-base font-bold text-slate-900">
                            Verification In Progress
                          </h2>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            Your 12-digit UTR <span className="font-mono font-semibold text-slate-900">{client.activationUtr}</span> was submitted on{' '}
                            {client.activationSubmittedAt
                              ? formatDateTime(client.activationSubmittedAt)
                              : 'just now'}
                            . Once {PLATFORM_OWNER_CONFIG.payeeName} verifies the ₹499 FamPay transaction in the Owner Admin Panel, your gateway activates immediately.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <h2 className="font-display text-base font-bold text-slate-900">
                            Step 2: Submit Your 12-Digit UPI UTR
                          </h2>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            After completing the ₹499 payment to <span className="font-mono font-medium text-slate-900">{PLATFORM_OWNER_CONFIG.upiId}</span>, copy the 12-digit UTR / UPI Reference ID from your payment receipt and enter it below.
                          </p>
                        </div>
                      )}

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
                          className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {client.status === 'PENDING_VERIFICATION'
                            ? 'Update Submitted UTR'
                            : 'Submit UTR for Verification'}
                        </button>
                      </form>
                    </div>
                  </div>
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
                  <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                      <div>
                        <h1 className="font-display text-xl font-bold text-slate-900">
                          Your Live Payment Gateway
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                          Share this URL with customers or pass <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">amount</code> and <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">order_id</code> parameters.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenLiveGateway(client.slug)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Open Live Checkout
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <input
                        type="text"
                        readOnly
                        value={baseGatewayUrl}
                        aria-label="Shareable gateway URL"
                        className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => copyText('base-url', baseGatewayUrl)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {copiedKey === 'base-url' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Copied Link
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Gateway URL
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      <div className="lg:col-span-7 space-y-5">
                        <div>
                          <h2 className="font-display text-lg font-bold text-slate-900">
                            Dynamic Payment Link &amp; QR Builder
                          </h2>
                          <p className="text-xs text-slate-500 mt-1">
                            Generate pre-filled checkout links for invoices, WhatsApp orders, or storefront buttons.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label
                              htmlFor="builder-amount"
                              className="block text-xs font-semibold text-slate-700 mb-1.5"
                            >
                              Amount (INR)
                            </label>
                            <input
                              id="builder-amount"
                              type="number"
                              min="1"
                              step="any"
                              value={customAmount}
                              onChange={(e) => setCustomAmount(e.target.value)}
                              placeholder="999"
                              className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 tabular-nums"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="builder-order-id"
                              className="block text-xs font-semibold text-slate-700 mb-1.5"
                            >
                              Order ID
                            </label>
                            <input
                              id="builder-order-id"
                              type="text"
                              value={customOrderId}
                              onChange={(e) => setCustomOrderId(e.target.value)}
                              placeholder="ORD123"
                              className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-slate-700">
                            Generated Checkout Link
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2.5">
                            <input
                              type="text"
                              readOnly
                              value={customGatewayUrl}
                              className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                            />
                            <button
                              type="button"
                              onClick={() => copyText('custom-url', customGatewayUrl)}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                            >
                              {copiedKey === 'custom-url' ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy Link
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onOpenLiveGateway(
                                  client.slug,
                                  !Number.isNaN(parsedBuilderAmount) && parsedBuilderAmount > 0
                                    ? parsedBuilderAmount
                                    : undefined,
                                  customOrderId.trim() || undefined
                                )
                              }
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                            >
                              Test Link
                            </button>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                              <Code2 className="w-4 h-4 text-slate-500" />
                              Website Embed Snippets
                            </h3>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-slate-600">
                                Iframe Checkout Embed
                              </span>
                              <button
                                type="button"
                                onClick={() => copyText('iframe-code', iframeEmbedSnippet)}
                                className="text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                              >
                                {copiedKey === 'iframe-code' ? 'Copied' : 'Copy HTML'}
                              </button>
                            </div>
                            <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto">
                              {iframeEmbedSnippet}
                            </pre>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-slate-600">
                                Direct Pay Button HTML
                              </span>
                              <button
                                type="button"
                                onClick={() => copyText('button-code', buttonEmbedSnippet)}
                                className="text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                              >
                                {copiedKey === 'button-code' ? 'Copied' : 'Copy Button'}
                              </button>
                            </div>
                            <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto">
                              {buttonEmbedSnippet}
                            </pre>
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-5 flex flex-col items-center p-6 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-xs font-semibold text-slate-700 mb-4">
                          Dynamic QR Preview
                        </p>
                        <QrCodeDisplay
                          value={previewMerchantIntent}
                          staticImageUrl={client.gatewayConfig.staticQrDataUrl}
                          size={200}
                          accentColor={client.gatewayConfig.accentColor}
                          allowDownload
                          downloadFileName={`${client.slug}-${customOrderId || 'upi'}-qr.png`}
                          label={`${client.gatewayConfig.payeeName} · ${client.gatewayConfig.upiId}`}
                        />
                      </div>
                    </div>
                  </div>
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
