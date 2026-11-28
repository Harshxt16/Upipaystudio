import { FormEvent, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Mail,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { PLATFORM_OWNER_CONFIG } from '../config/platform';
import { validateStrictActivationUtr } from '../lib/fampaySync';
import { formatDateTime, submitActivationUtr } from '../lib/storage';
import { ClientAccount } from '../types';
import { ClientStatusLabel } from './StatusIndicator';

interface ConciergeGatewayCardProps {
  client: ClientAccount;
  onGoToSetup: () => void;
  onMakeFurtherPayment?: () => void;
  onRefresh: () => void;
}

export function ConciergeGatewayCard({
  client,
  onGoToSetup,
  onMakeFurtherPayment,
  onRefresh,
}: ConciergeGatewayCardProps) {
  const isVerified = client.status === 'ACTIVE';
  const [showUtrEditor, setShowUtrEditor] = useState(false);
  const [utrInput, setUtrInput] = useState(
    client.activationUtr && client.activationUtr !== 'UPI-APP-PAID' ? client.activationUtr : ''
  );
  const [utrError, setUtrError] = useState('');
  const [utrUpdated, setUtrUpdated] = useState(false);
  const [savingUtr, setSavingUtr] = useState(false);

  const handleUpdateUtr = async (e: FormEvent) => {
    e.preventDefault();
    setUtrError('');
    setUtrUpdated(false);
    const check = validateStrictActivationUtr(utrInput);
    if (!check.valid) {
      setUtrError(check.error || 'Enter a valid alphanumeric UPI UTR / Reference Number (8–32 chars).');
      return;
    }
    setSavingUtr(true);
    try {
      await submitActivationUtr(client.id, check.cleaned);
      setUtrUpdated(true);
      setShowUtrEditor(false);
      onRefresh();
    } catch (err) {
      setUtrError(err instanceof Error ? err.message : 'Failed to update UTR.');
    } finally {
      setSavingUtr(false);
    }
  };

  const brandColor = client.gatewayConfig?.accentColor || '#0F766E';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Hero Vector Banner */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 text-white px-6 py-8 sm:px-10 sm:py-10 overflow-hidden">
        {/* Subtle geometric backdrop */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-300 tracking-wide">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {isVerified
                  ? 'Lifetime Payment Verified · Priority Onboarding'
                  : 'Payment Reference Received · Official Onboarding Queue'}
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug [text-wrap:balance]">
              Our team will contact you soon with your personalized payment gateway
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
              {isVerified
                ? `Your ₹${PLATFORM_OWNER_CONFIG.lifetimeFeeInr} lifetime license for ${client.entityName} is confirmed. Our engineering team is preparing your custom-branded UPI checkout setup and will contact you at ${client.email} shortly.`
                : `Thank you for submitting your ₹${PLATFORM_OWNER_CONFIG.lifetimeFeeInr} lifetime payment for ${client.entityName}. Once our team completes verification (within 24 hours), we will contact you at ${client.email} with your personalized payment gateway.`}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-5 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-teal-300" />
                Delivery Email: <strong className="text-white font-medium">{client.email}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono">
                ID: <strong className="text-white">{client.merchantCode || client.id}</strong>
              </span>
            </div>
          </div>

          {/* Attractive Custom Vector Illustration */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <svg
              viewBox="0 0 380 250"
              className="w-full max-w-[360px] h-auto drop-shadow-2xl"
              role="img"
              aria-label="Personalized payment gateway preparation illustration"
            >
              <defs>
                <linearGradient id="cardSurface" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#F1F5F9" />
                </linearGradient>
                <linearGradient id="tealGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#0F766E" stopOpacity="0.06" />
                </linearGradient>
                <linearGradient id="accentHeader" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={brandColor} />
                  <stop offset="100%" stopColor="#0F766E" />
                </linearGradient>
                <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>

              {/* Soft ambient backdrop halo */}
              <circle cx="195" cy="128" r="102" fill="url(#tealGlow)" />
              <circle
                cx="195"
                cy="128"
                r="114"
                fill="none"
                stroke="#2DD4BF"
                strokeOpacity="0.18"
                strokeWidth="1"
                strokeDasharray="4 6"
              />

              {/* Background decorative browser sheet */}
              <rect
                x="44"
                y="26"
                width="244"
                height="168"
                rx="14"
                fill="#1E293B"
                stroke="#334155"
                strokeWidth="1.5"
              />
              <circle cx="62" cy="42" r="3.5" fill="#475569" />
              <circle cx="74" cy="42" r="3.5" fill="#475569" />
              <circle cx="86" cy="42" r="3.5" fill="#475569" />

              {/* Main Personalized Gateway Card */}
              <rect
                x="70"
                y="46"
                width="230"
                height="164"
                rx="14"
                fill="url(#cardSurface)"
                stroke="#CBD5E1"
                strokeWidth="1.5"
              />
              {/* Branded top strip */}
              <path
                d="M70 60 C70 52.268 76.268 46 84 46 H286 C293.732 46 300 52.268 300 60 V82 H70 Z"
                fill="url(#accentHeader)"
              />
              <rect x="86" y="58" width="74" height="8" rx="4" fill="#FFFFFF" fillOpacity="0.9" />
              <rect x="86" y="70" width="48" height="5" rx="2.5" fill="#FFFFFF" fillOpacity="0.55" />

              {/* Verified badge inside card header */}
              <rect x="230" y="56" width="56" height="16" rx="4" fill="#FFFFFF" fillOpacity="0.18" />
              <circle cx="240" cy="64" r="3.5" fill="#34D399" />
              <rect x="247" y="62" width="32" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.92" />

              {/* Stylized QR Matrix on left inside card */}
              <rect
                x="86"
                y="98"
                width="74"
                height="74"
                rx="8"
                fill="#FFFFFF"
                stroke="#E2E8F0"
                strokeWidth="1.5"
              />
              {/* QR finder squares */}
              <rect x="94" y="106" width="18" height="18" rx="3" fill="none" stroke="#0F172A" strokeWidth="3" />
              <rect x="100" y="112" width="6" height="6" rx="1" fill="#0F172A" />

              <rect x="134" y="106" width="18" height="18" rx="3" fill="none" stroke="#0F172A" strokeWidth="3" />
              <rect x="140" y="112" width="6" height="6" rx="1" fill="#0F172A" />

              <rect x="94" y="146" width="18" height="18" rx="3" fill="none" stroke="#0F172A" strokeWidth="3" />
              <rect x="100" y="152" width="6" height="6" rx="1" fill="#0F172A" />

              {/* QR data modules */}
              <rect x="118" y="106" width="8" height="8" rx="1.5" fill="#0F766E" />
              <rect x="118" y="120" width="8" height="8" rx="1.5" fill="#0F172A" />
              <rect x="94" y="131" width="10" height="8" rx="1.5" fill="#0F172A" />
              <rect x="110" y="131" width="14" height="8" rx="1.5" fill="#0F766E" />
              <rect x="132" y="131" width="20" height="8" rx="1.5" fill="#0F172A" />
              <rect x="120" y="146" width="12" height="8" rx="1.5" fill="#0F172A" />
              <rect x="138" y="146" width="14" height="18" rx="2" fill="#0F766E" />
              <rect x="120" y="158" width="12" height="6" rx="1.5" fill="#0F172A" />

              {/* Right column payment details */}
              <rect x="174" y="100" width="52" height="7" rx="3.5" fill="#94A3B8" />
              <rect x="174" y="114" width="106" height="14" rx="4" fill="#E2E8F0" />
              <rect x="180" y="119" width="62" height="4" rx="2" fill="#334155" />
              <rect x="174" y="136" width="84" height="7" rx="3.5" fill="#CBD5E1" />

              {/* CTA bar inside card */}
              <rect x="174" y="154" width="106" height="22" rx="6" fill="#0F172A" />
              <rect x="196" y="163" width="62" height="4.5" rx="2.25" fill="#FFFFFF" />

              {/* Bottom security strip */}
              <rect x="86" y="184" width="194" height="14" rx="4" fill="#ECFDF5" />
              <circle cx="96" cy="191" r="3" fill="#10B981" />
              <rect x="105" y="189" width="110" height="4" rx="2" fill="#065F46" fillOpacity="0.65" />

              {/* Floating Verified Shield Badge (top right) */}
              <g transform="translate(274, 24)">
                <rect
                  x="0"
                  y="0"
                  width="64"
                  height="64"
                  rx="16"
                  fill="#0F172A"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                <path
                  d="M32 13 L48 19.5 V31.5 C48 41.2 41.1 49.4 32 52 C22.9 49.4 16 41.2 16 31.5 V19.5 L32 13 Z"
                  fill="url(#shieldGrad)"
                />
                <path
                  d="M25.5 32.5 L30 37 L39.5 27"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>

              {/* Floating Concierge Delivery Card (bottom right) */}
              <g transform="translate(232, 174)">
                <rect
                  x="0"
                  y="0"
                  width="124"
                  height="52"
                  rx="11"
                  fill="#FFFFFF"
                  stroke="#CBD5E1"
                  strokeWidth="1.5"
                />
                <rect x="11" y="12" width="28" height="28" rx="7" fill="#CCFBF1" />
                <path
                  d="M17 21 L25 27 L33 21 M17 21 H33 V32 H17 Z"
                  fill="none"
                  stroke="#0F766E"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect x="47" y="16" width="62" height="6" rx="3" fill="#0F172A" />
                <rect x="47" y="27" width="46" height="5" rx="2.5" fill="#64748B" />
              </g>

              {/* Connection dots */}
              <circle cx="30" cy="112" r="5" fill="#2DD4BF" fillOpacity="0.6" />
              <circle cx="352" cy="128" r="4" fill="#34D399" fillOpacity="0.7" />
              <circle cx="52" cy="218" r="3.5" fill="#94A3B8" fillOpacity="0.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* Onboarding Progress & Verification Details */}
      <div className="p-6 sm:p-8 space-y-8">
        {/* 3-Step Verification Progress */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-slate-900">
              Onboarding &amp; Delivery Status
            </h2>
            <ClientStatusLabel status={client.status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                {client.gatewayConfig ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                1. Business &amp; UPI Details
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {client.gatewayConfig
                  ? `Saved for ${client.gatewayConfig.upiId}`
                  : 'Add your receiving UPI ID in Gateway Setup so we can personalize your checkout.'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                {isVerified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                )}
                2. ₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr} License Verification
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isVerified
                  ? `₹${PLATFORM_OWNER_CONFIG.lifetimeFeeInr} payment verified via bank sync and lifetime license activated.`
                  : `Verifying payment via bank sync... This page unlocks automatically once ₹${PLATFORM_OWNER_CONFIG.lifetimeFeeInr} is confirmed.`}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-900">
                <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
                3. Team Outreach &amp; Delivery
              </div>
              <p className="text-xs text-teal-800 leading-relaxed">
                Our team will contact you soon at <span className="font-semibold">{client.email}</span> with your personalized payment gateway.
              </p>
            </div>
          </div>
        </div>

        {/* Registered Account Summary Receipt */}
        <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/40">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Official Onboarding Record
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-xs">
            <div>
              <p className="text-slate-500">Business / Entity</p>
              <p className="font-semibold text-slate-900 mt-1">{client.entityName}</p>
            </div>
            <div>
              <p className="text-slate-500">Registered Contact</p>
              <p className="font-medium text-slate-900 mt-1 break-all">{client.email}</p>
            </div>
            <div>
              <p className="text-slate-500">Receiving UPI ID</p>
              <p className="font-mono font-semibold text-slate-900 mt-1">
                {client.gatewayConfig?.upiId || 'Not configured yet'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">₹{PLATFORM_OWNER_CONFIG.lifetimeFeeInr} Payment Reference</p>
              <p className="font-mono font-semibold text-slate-900 mt-1 tabular-nums">
                {client.activationUtr || 'Submitted'}
              </p>
              {client.activationSubmittedAt && (
                <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  {formatDateTime(client.activationSubmittedAt)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions: Finish setup if missing, or update UTR if pending */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-200">
          {!client.gatewayConfig ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
              <p className="text-xs text-amber-800 font-medium">
                Please add your UPI ID and brand details in Gateway Setup so our team can build your personalized gateway accurately.
              </p>
              <button
                type="button"
                onClick={onGoToSetup}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Complete Gateway Setup
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                Need to adjust your UPI ID or display name before delivery?{' '}
                <button
                  type="button"
                  onClick={onGoToSetup}
                  className="font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-4 cursor-pointer"
                >
                  Update Gateway Setup
                </button>
              </p>

              <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                {onMakeFurtherPayment && (
                  <button
                    type="button"
                    onClick={onMakeFurtherPayment}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    Make Further Payment
                  </button>
                )}

                {!isVerified && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUtrEditor((s) => !s);
                      setUtrUpdated(false);
                    }}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer"
                  >
                    {showUtrEditor ? 'Hide UTR Editor' : 'Update UTR / Ref ID'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {utrUpdated && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-700">
            Your UTR / Reference ID has been updated for our verification team.
          </div>
        )}

        {!isVerified && showUtrEditor && (
          <form
            onSubmit={handleUpdateUtr}
            className="max-w-md p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
          >
            <label
              htmlFor="concierge-utr-edit"
              className="block text-xs font-semibold text-slate-700"
            >
              Update UPI UTR / Reference Number (Varchar)
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="concierge-utr-edit"
                type="text"
                maxLength={32}
                required
                value={utrInput}
                onChange={(e) =>
                  setUtrInput(
                    e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 32)
                  )
                }
                placeholder="e.g. 412345678901 or FP2611268901"
                className="flex-1 px-3 py-2 text-sm font-mono tracking-wider uppercase bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 tabular-nums"
              />
              <button
                type="submit"
                disabled={savingUtr}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap"
              >
                {savingUtr ? 'Saving...' : 'Save UTR'}
              </button>
            </div>
            {utrError && (
              <p className="text-xs font-medium text-red-700">{utrError}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
