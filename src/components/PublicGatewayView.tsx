import { FormEvent, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Lock,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import {
  buildUpiIntentUri,
  createCustomerOrder,
  formatDateTime,
  formatInr,
  getClientBySlug,
  isValidUtr,
} from '../lib/storage';
import { CustomerOrder } from '../types';
import { QrCodeDisplay } from './QrCodeDisplay';

interface PublicGatewayViewProps {
  slug: string;
  initialAmount?: number;
  initialOrderId?: string;
  embed?: boolean;
  onExitGateway: () => void;
}

export function PublicGatewayView({
  slug,
  initialAmount,
  initialOrderId,
  embed = false,
  onExitGateway,
}: PublicGatewayViewProps) {
  const client = getClientBySlug(slug);

  const generatedFallbackOrderId = useMemo(
    () => `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
    []
  );

  const [amountInput, setAmountInput] = useState(
    initialAmount && initialAmount > 0 ? String(initialAmount) : ''
  );
  const [orderIdInput, setOrderIdInput] = useState(
    initialOrderId?.trim() || generatedFallbackOrderId
  );
  const [customerName, setCustomerName] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [utrInput, setUtrInput] = useState('');
  const [error, setError] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<CustomerOrder | null>(null);

  if (!client || client.status !== 'ACTIVE' || !client.gatewayConfig) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            {client ? 'Gateway Pending Activation' : 'Payment Gateway Not Found'}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {client
              ? `The payment gateway for ${client.entityName} is not active yet. Please contact the merchant or check back once verification completes.`
              : `No active UPI payment gateway was found for "${slug}".`}
          </p>
          {!embed && (
            <button
              type="button"
              onClick={onExitGateway}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to UPIPay Studio
            </button>
          )}
        </div>
      </div>
    );
  }

  const { gatewayConfig } = client;
  const accentColor = gatewayConfig.accentColor || '#0F766E';
  const numericAmount = Number(amountInput);
  const isValidAmount = !Number.isNaN(numericAmount) && numericAmount > 0;
  const effectiveOrderId = orderIdInput.trim() || generatedFallbackOrderId;

  const upiUri = buildUpiIntentUri({
    pa: gatewayConfig.upiId,
    pn: gatewayConfig.payeeName,
    am: isValidAmount ? numericAmount : undefined,
    tn: effectiveOrderId,
  });

  const handleCopyUpi = () => {
    navigator.clipboard?.writeText(gatewayConfig.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 1800);
  };

  const handleSubmitOrder = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidAmount) {
      setError('Please enter a valid payment amount in INR.');
      return;
    }

    const cleanedUtr = utrInput.replace(/\s+/g, '');
    if (!isValidUtr(cleanedUtr)) {
      setError('Please enter a valid 12-digit numeric UPI UTR / Reference Number.');
      return;
    }

    const created = createCustomerOrder({
      clientId: client.id,
      clientSlug: client.slug,
      orderId: effectiveOrderId,
      amount: numericAmount,
      utr: cleanedUtr,
      customerName,
      customerNote,
    });
    setSubmittedOrder(created);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <div>
        {!embed && (
          <div className="max-w-4xl mx-auto px-4 pt-6 flex items-center justify-between text-xs text-slate-500">
            <button
              type="button"
              onClick={onExitGateway}
              className="inline-flex items-center gap-1.5 font-medium hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              UPIPay Studio
            </button>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              Direct UPI Settlement
            </span>
          </div>
        )}

        <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />

            {submittedOrder ? (
              <div className="p-8 sm:p-10 max-w-lg mx-auto text-center space-y-6">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <h1 className="font-display text-2xl font-bold text-slate-900">
                    Payment Reference Submitted
                  </h1>
                  <p className="text-sm text-slate-600">
                    Your 12-digit UTR has been logged with <span className="font-semibold text-slate-900">{client.entityName}</span> for verification.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Order ID</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {submittedOrder.orderId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Amount Paid</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatInr(submittedOrder.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Submitted UTR</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {submittedOrder.utr}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Logged At</span>
                    <span className="text-slate-700">
                      {formatDateTime(submittedOrder.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  {gatewayConfig.redirectUrl && (
                    <a
                      href={gatewayConfig.redirectUrl}
                      target="_top"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
                      style={{ backgroundColor: accentColor }}
                    >
                      Continue to {client.entityName}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedOrder(null);
                      setUtrInput('');
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    Make Another Payment
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12">
                <div className="md:col-span-5 p-6 sm:p-8 bg-slate-50/70 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between space-y-6">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Paying Merchant</p>
                    <h1 className="font-display text-xl font-bold text-slate-900">
                      {client.entityName}
                    </h1>
                    <p className="text-xs text-slate-600">
                      Payee: {gatewayConfig.payeeName}
                    </p>
                  </div>

                  <div className="flex flex-col items-center">
                    <QrCodeDisplay
                      value={upiUri}
                      staticImageUrl={gatewayConfig.staticQrDataUrl}
                      size={200}
                      accentColor={accentColor}
                      label={
                        isValidAmount
                          ? `Scan with any UPI App · ${formatInr(numericAmount)}`
                          : 'Enter an amount to embed into QR'
                      }
                    />
                  </div>

                  <div className="space-y-3">
                    {isValidAmount ? (
                      <a
                        href={upiUri}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90 whitespace-nowrap"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Smartphone className="w-4 h-4" />
                        Pay {formatInr(numericAmount)} via UPI App
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-slate-400 bg-slate-200 rounded-lg cursor-not-allowed whitespace-nowrap"
                      >
                        <Smartphone className="w-4 h-4" />
                        Enter Amount to Pay via App
                      </button>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
                      <span className="text-slate-500">UPI ID</span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="inline-flex items-center gap-1.5 font-mono font-medium text-slate-800 hover:text-slate-900 cursor-pointer"
                      >
                        {gatewayConfig.upiId}
                        {copiedUpi ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-7 p-6 sm:p-8 space-y-6">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Order &amp; Payment Confirmation
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Scan the QR code or tap Pay via UPI App, then submit your 12-digit UTR below.
                    </p>
                  </div>

                  <form onSubmit={handleSubmitOrder} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="checkout-amount"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Amount (₹ INR)
                        </label>
                        <input
                          id="checkout-amount"
                          type="number"
                          min="1"
                          step="any"
                          required
                          readOnly={Boolean(initialAmount && initialAmount > 0)}
                          value={amountInput}
                          onChange={(e) => setAmountInput(e.target.value)}
                          placeholder="Enter amount (e.g. 999)"
                          className={`w-full px-3.5 py-2.5 text-base font-mono font-semibold border border-slate-200 rounded-lg text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 ${
                            initialAmount && initialAmount > 0 ? 'bg-slate-50' : 'bg-white'
                          }`}
                        />
                        {!initialAmount && (
                          <div className="flex items-center gap-1.5 mt-2">
                            {[199, 499, 999, 1999].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setAmountInput(String(preset))}
                                className="px-2 py-1 text-[11px] font-mono font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer tabular-nums"
                              >
                                ₹{preset}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="checkout-order-id"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Order Reference
                        </label>
                        <input
                          id="checkout-order-id"
                          type="text"
                          required
                          readOnly={Boolean(initialOrderId)}
                          value={orderIdInput}
                          onChange={(e) => setOrderIdInput(e.target.value)}
                          className={`w-full px-3.5 py-2.5 text-sm font-mono border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 ${
                            initialOrderId ? 'bg-slate-50' : 'bg-white'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="customer-name"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Your Name (Optional)
                        </label>
                        <input
                          id="customer-name"
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Rohan Sharma"
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="customer-note"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Note / Email (Optional)
                        </label>
                        <input
                          id="customer-note"
                          type="text"
                          value={customerNote}
                          onChange={(e) => setCustomerNote(e.target.value)}
                          placeholder="rohan@example.com"
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <label
                        htmlFor="customer-utr"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        12-Digit UPI UTR / Reference Number
                      </label>
                      <input
                        id="customer-utr"
                        type="text"
                        inputMode="numeric"
                        maxLength={12}
                        required
                        value={utrInput}
                        onChange={(e) =>
                          setUtrInput(e.target.value.replace(/\D/g, '').slice(0, 12))
                        }
                        placeholder="Enter 12-digit UTR after paying (e.g. 412345678901)"
                        className="w-full px-3.5 py-2.5 text-base font-mono tracking-wider bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 tabular-nums"
                      />
                    </div>

                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3 px-5 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90 cursor-pointer whitespace-nowrap"
                      style={{ backgroundColor: accentColor }}
                    >
                      Submit 12-Digit UTR &amp; Complete Order
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {!embed && (
        <footer className="py-6 text-center text-xs text-slate-400">
          Powered by UPIPay Studio · Direct Merchant UPI Checkout
        </footer>
      )}
    </div>
  );
}
