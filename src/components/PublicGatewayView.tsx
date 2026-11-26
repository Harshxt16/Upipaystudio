import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Lock,
  QrCode,
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

type CheckoutStep =
  | 'choose'
  | 'qr'
  | 'upi_waiting'
  | 'upi_return'
  | 'not_confirmed'
  | 'confirmed';

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
  const [appUtrInput, setAppUtrInput] = useState('');
  const [step, setStep] = useState<CheckoutStep>('choose');
  const [error, setError] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<CustomerOrder | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState('');

  useEffect(() => {
    if (step !== 'upi_waiting') return;
    const onReturn = () => {
      if (document.visibilityState === 'visible') {
        setStep('upi_return');
      }
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [step]);

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

  const handleSelectQr = () => {
    setError('');
    if (!isValidAmount) {
      setError('Please enter a valid payment amount in INR first.');
      return;
    }
    setStep('qr');
  };

  const handleSelectUpiApp = () => {
    setError('');
    if (!isValidAmount) {
      setError('Please enter a valid payment amount in INR first.');
      return;
    }
    setStep('upi_waiting');
    try {
      window.location.href = upiUri;
    } catch {
      // Ignore scheme block in desktop browser
    }
  };

  const handleSubmitQrOrder = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidAmount) {
      setError('Please enter a valid payment amount in INR.');
      return;
    }

    const cleanedUtr = utrInput.replace(/\s+/g, '').toUpperCase();
    if (!isValidUtr(cleanedUtr)) {
      setError('Please enter a valid UPI UTR / Reference Number (8–32 alphanumeric characters).');
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
    setConfirmationMessage(
      'Your UTR reference has been logged. Verification may take up to 24 hours.'
    );
    setStep('confirmed');
  };

  const handleConfirmUpiAppReturn = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const cleaned = appUtrInput.replace(/\s+/g, '').toUpperCase();
    const created = createCustomerOrder({
      clientId: client.id,
      clientSlug: client.slug,
      orderId: effectiveOrderId,
      amount: numericAmount,
      utr: isValidUtr(cleaned) ? cleaned : 'UPI-APP-PAID',
      customerName,
      customerNote,
    });
    setSubmittedOrder(created);
    setConfirmationMessage('Payment confirmed via UPI App.');
    setStep('confirmed');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <div>
        {!embed && (
          <div className="max-w-2xl mx-auto px-4 pt-6 flex items-center justify-between text-xs text-slate-500">
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

        <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div
              className="h-1.5 w-full"
              style={{
                backgroundColor: step === 'not_confirmed' ? '#DC2626' : accentColor,
              }}
            />

            {step === 'confirmed' && submittedOrder ? (
              <div className="p-8 sm:p-10 max-w-lg mx-auto text-center space-y-6">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <h1 className="font-display text-2xl font-bold text-slate-900">
                    Order Reference Recorded
                  </h1>
                  <p className="text-sm text-slate-600">{confirmationMessage}</p>
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
                    <span className="text-slate-500">Reference / UTR</span>
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
                  {gatewayConfig.redirectUrl ? (
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
                  ) : (
                    <button
                      type="button"
                      onClick={onExitGateway}
                      className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white rounded-lg cursor-pointer"
                      style={{ backgroundColor: accentColor }}
                    >
                      Back to Page
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedOrder(null);
                      setUtrInput('');
                      setAppUtrInput('');
                      setStep('choose');
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    Make Another Payment
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-200">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Paying Merchant</p>
                    <h1 className="font-display text-xl font-bold text-slate-900">
                      {step === 'not_confirmed' ? 'Order Not Confirmed' : client.entityName}
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Payee: {gatewayConfig.payeeName} · UPI: <span className="font-mono text-slate-700">{gatewayConfig.upiId}</span>
                    </p>
                  </div>

                  {isValidAmount && (
                    <div className="sm:text-right">
                      <p className="text-xs text-slate-500">Payable Amount</p>
                      <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                        {formatInr(numericAmount)}
                      </p>
                    </div>
                  )}
                </div>

                {step === 'choose' && (
                  <div className="space-y-5">
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

                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
                        {error}
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 space-y-3">
                      <p className="text-xs font-semibold text-slate-700">
                        Select Payment Method:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={handleSelectQr}
                          className="text-left p-4 bg-white border border-slate-200 hover:border-slate-900 rounded-xl transition-colors cursor-pointer flex items-start gap-3"
                        >
                          <QrCode className="w-5 h-5 text-slate-800 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-slate-900">Pay through QR</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Scan QR &amp; enter UPI UTR / Ref ID (up to 24 hrs verification)
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={handleSelectUpiApp}
                          className="text-left p-4 bg-white border border-slate-200 hover:border-slate-900 rounded-xl transition-colors cursor-pointer flex items-start gap-3"
                        >
                          <Smartphone className="w-5 h-5 text-slate-800 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-slate-900">Pay through UPI App</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Open GPay, PhonePe, Paytm, or FamPay on your phone
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 'qr' && (
                  <div className="space-y-5">
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setStep('choose');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Change Payment Method
                    </button>

                    <div className="flex flex-col items-center p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <QrCodeDisplay
                        value={upiUri}
                        staticImageUrl={gatewayConfig.staticQrDataUrl}
                        size={200}
                        accentColor={accentColor}
                        label={`Scan with any UPI App · ${formatInr(numericAmount)}`}
                      />
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
                      >
                        {gatewayConfig.upiId}
                        {copiedUpi ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                    </div>

                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                      <strong>Note:</strong> After scanning and completing payment, submit your UPI UTR / Reference Number below. Verification may take up to <strong>24 hours</strong>.
                    </div>

                    <form onSubmit={handleSubmitQrOrder} className="space-y-4">
                      <div>
                        <label
                          htmlFor="customer-utr"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          UPI UTR / Reference Number (Varchar)
                        </label>
                        <input
                          id="customer-utr"
                          type="text"
                          maxLength={32}
                          required
                          value={utrInput}
                          onChange={(e) =>
                            setUtrInput(
                              e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 32)
                            )
                          }
                          placeholder="Enter UTR / Ref ID (e.g. 412345678901 or FP2611268901)"
                          className="w-full px-3.5 py-2.5 text-base font-mono tracking-wider uppercase bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 tabular-nums"
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
                        Submit UTR &amp; Place Order
                      </button>
                    </form>
                  </div>
                )}

                {step === 'upi_waiting' && (
                  <div className="space-y-4">
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <p className="text-sm font-bold text-slate-900">Opening your UPI app...</p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Complete the {formatInr(numericAmount)} payment in your UPI app and return to this page. If your UPI app did not open automatically, tap below.
                      </p>
                    </div>

                    <a
                      href={upiUri}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-lg"
                      style={{ backgroundColor: accentColor }}
                    >
                      <Smartphone className="w-4 h-4" />
                      Open UPI App Again
                    </a>

                    <button
                      type="button"
                      onClick={() => setStep('upi_return')}
                      className="w-full py-2.5 px-4 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                    >
                      I Returned From UPI App
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep('not_confirmed')}
                      className="w-full py-2.5 px-4 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer"
                    >
                      Cancel / Payment Not Done
                    </button>
                  </div>
                )}

                {step === 'upi_return' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="font-display text-base font-bold text-slate-900">
                        Did you complete the payment in your UPI app?
                      </h2>
                      <p className="text-xs text-slate-500">
                        Confirm whether your {formatInr(numericAmount)} payment succeeded to proceed.
                      </p>
                    </div>

                    <form onSubmit={handleConfirmUpiAppReturn} className="space-y-3">
                      <div>
                        <label
                          htmlFor="app-utr"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          UPI UTR / Ref ID (Optional if paid via UPI app)
                        </label>
                        <input
                          id="app-utr"
                          type="text"
                          maxLength={32}
                          value={appUtrInput}
                          onChange={(e) =>
                            setAppUtrInput(
                              e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 32)
                            )
                          }
                          placeholder="Optional UTR / Ref ID"
                          className="w-full px-3.5 py-2.5 text-sm font-mono uppercase bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 tabular-nums"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-3 px-4 text-sm font-semibold text-white rounded-lg cursor-pointer"
                        style={{ backgroundColor: accentColor }}
                      >
                        Yes, Payment Completed
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={() => setStep('not_confirmed')}
                      className="w-full py-2.5 px-4 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer"
                    >
                      No, Payment Not Done
                    </button>
                  </div>
                )}

                {step === 'not_confirmed' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-xs text-red-800">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        Payment was not completed in your UPI app, so this order is <strong>not confirmed</strong>. No order has been placed.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSelectUpiApp}
                      className="w-full py-3 px-4 text-sm font-semibold text-white rounded-lg cursor-pointer"
                      style={{ backgroundColor: accentColor }}
                    >
                      Retry via UPI App
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep('qr')}
                      className="w-full py-2.5 px-4 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                    >
                      Pay through QR Code Instead
                    </button>
                  </div>
                )}
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
