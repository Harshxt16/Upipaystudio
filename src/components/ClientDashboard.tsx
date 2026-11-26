import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  ImagePlus,
  Lock,
  QrCode,
  Settings2,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { BRAND_ACCENT_PRESETS, PLATFORM_OWNER_CONFIG } from '../config/platform';
import {
  buildUpiIntentUri,
  isValidOptionalUrl,
  isValidUpiId,
  isValidUtr,
  submitActivationUtr,
  updateClientGatewayConfig,
} from '../lib/storage';
import { ClientAccount, CustomerOrder } from '../types';
import { ConciergeGatewayCard } from './ConciergeGatewayCard';
import { QrCodeDisplay } from './QrCodeDisplay';
import { ClientStatusLabel } from './StatusIndicator';

type DashboardTab = 'setup' | 'activation' | 'gateway';
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
  onRefresh,
}: ClientDashboardProps) {
  const initialTab: DashboardTab = useMemo(() => {
    if (client.status === 'ACTIVE' || client.status === 'PENDING_VERIFICATION') {
      return 'gateway';
    }
    if (!client.gatewayConfig) return 'setup';
    return 'activation';
  }, [client.gatewayConfig, client.status]);

  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);

  // Setup Wizard Form State
  const [upiId, setUpiId] = useState(client.gatewayConfig?.upiId || '');
  const [payeeName, setPayeeName] = useState(
    client.gatewayConfig?.payeeName || client.entityName
  );
  const [adminPin, setAdminPin] = useState(client.gatewayConfig?.adminPin || '');
  const [showSetupPin, setShowSetupPin] = useState(false);
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
  const [savingSetup, setSavingSetup] = useState(false);

  // Activation Payment & UTR State
  const [activationPayStep, setActivationPayStep] = useState<ActivationPayStep>('choose');
  const [activationUtr, setActivationUtr] = useState(
    client.activationUtr && client.activationUtr !== 'UPI-APP-PAID' ? client.activationUtr : ''
  );
  const [activationAppUtr, setActivationAppUtr] = useState('');
  const [activationError, setActivationError] = useState('');
  const [submittingActivation, setSubmittingActivation] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string>('');

  const copyText = (key: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? '' : prev)), 1800);
  };

  const handleStaticQrUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 350 * 1024) {
      setSetupError('QR image must be under 350 KB for cloud storage.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (reader.result.length > 500000) {
          setSetupError('Encoded QR image is too large. Please upload a smaller image.');
          return;
        }
        setStaticQrDataUrl(reader.result);
        setSetupError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveGateway = async (e: FormEvent) => {
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

    setSavingSetup(true);
    try {
      await updateClientGatewayConfig(client.id, {
        upiId: upiId.trim(),
        payeeName: payeeName.trim(),
        adminPin: adminPin.trim(),
        staticQrDataUrl,
        accentColor,
        redirectUrl: redirectUrl.trim() || undefined,
      });
      onRefresh();

      if (client.status !== 'ACTIVE' && client.status !== 'PENDING_VERIFICATION') {
        setSetupSavedMsg('Gateway details saved. Complete ₹499 activation and our team will contact you soon.');
        setActiveTab('activation');
      } else if (client.status === 'PENDING_VERIFICATION') {
        setSetupSavedMsg('Gateway details saved. Our team will contact you soon once your payment is verified.');
        setActiveTab('gateway');
      } else {
        setSetupSavedMsg('Gateway configuration updated for your personalized payment gateway.');
      }
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Failed to save gateway configuration.');
    } finally {
      setSavingSetup(false);
    }
  };

  const activationRefCode = `LIFETIME_${client.merchantCode || client.id.slice(0, 8)}`;

  const activationIntentUri = buildUpiIntentUri({
    pa: PLATFORM_OWNER_CONFIG.upiId,
    pn: PLATFORM_OWNER_CONFIG.payeeName,
    am: PLATFORM_OWNER_CONFIG.lifetimeFeeInr,
    tn: activationRefCode,
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

  const handleActivationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setActivationError('');
    const cleaned = activationUtr.replace(/\s+/g, '');
    if (!isValidUtr(cleaned)) {
      setActivationError('Enter a valid 12-digit numeric UPI UTR / Reference Number.');
      return;
    }
    setSubmittingActivation(true);
    try {
      await submitActivationUtr(client.id, cleaned);
      onRefresh();
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : 'Failed to submit UTR.');
    } finally {
      setSubmittingActivation(false);
    }
  };

  const handleActivationUpiAppConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setActivationError('');
    const cleaned = activationAppUtr.replace(/\s+/g, '');
    setSubmittingActivation(true);
    try {
      await submitActivationUtr(client.id, isValidUtr(cleaned) ? cleaned : 'UPI-APP-PAID');
      onRefresh();
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : 'Failed to confirm payment.');
    } finally {
      setSubmittingActivation(false);
    }
  };

  const navItems: { id: DashboardTab; label: string; icon: typeof Settings2; locked?: boolean }[] = [
    { id: 'setup', label: 'Gateway Setup', icon: Settings2 },
    { id: 'activation', label: 'Lifetime License (₹499)', icon: CreditCard },
    {
      id: 'gateway',
      label: 'Personalized Gateway',
      icon: ShieldCheck,
      locked: client.status !== 'ACTIVE' && client.status !== 'PENDING_VERIFICATION',
    },
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
              <span className="font-mono text-slate-900 font-medium">
                {client.merchantCode || client.id.slice(0, 8)}
              </span>
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
                    disabled={savingSetup}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {savingSetup
                      ? 'Saving...'
                      : client.gatewayConfig
                      ? 'Save Configuration'
                      : 'Save & Continue to Activation'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'activation' && (
            <>
              {client.status === 'ACTIVE' || client.status === 'PENDING_VERIFICATION' ? (
                <ConciergeGatewayCard
                  client={client}
                  onGoToSetup={() => setActiveTab('setup')}
                  onRefresh={onRefresh}
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
                  <div className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h1 className="font-display text-xl font-bold text-slate-900">
                        ₹499 Lifetime Gateway Activation
                      </h1>
                      <p className="text-sm text-slate-500 mt-1">
                        Complete the one-time ₹499 payment and our team will contact you soon with your personalized payment gateway.
                      </p>
                    </div>
                    <ClientStatusLabel status={client.status} />
                  </div>

                  {!client.gatewayConfig && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs font-medium text-amber-800">
                        Please configure your merchant UPI ID in Gateway Setup so our team can personalize your gateway.
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
                                <span className="font-mono text-slate-900">{activationRefCode}</span>
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
                                disabled={submittingActivation}
                                className="w-full px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                              >
                                {submittingActivation ? 'Submitting...' : 'Submit UTR for Verification'}
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
                              disabled={submittingActivation}
                              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
                            >
                              {submittingActivation ? 'Confirming...' : 'Yes, Payment Completed'}
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
                </div>
              )}
            </>
          )}

          {activeTab === 'gateway' && (
            <>
              {client.status === 'ACTIVE' || client.status === 'PENDING_VERIFICATION' ? (
                <ConciergeGatewayCard
                  client={client}
                  onGoToSetup={() => setActiveTab('setup')}
                  onRefresh={onRefresh}
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
                  <Lock className="w-8 h-8 text-slate-400 mx-auto" />
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Personalized Gateway Locked Until Payment
                  </h2>
                  <p className="text-sm text-slate-600 max-w-md mx-auto">
                    Complete the one-time ₹499 lifetime payment and our team will contact you soon with your personalized payment gateway.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('activation')}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Go to ₹499 Activation
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
