import { FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Play,
  QrCode,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  X,
} from 'lucide-react';
import {
  buildUpiIntentUri,
  createCustomerOrder,
  formatInr,
  isValidUtr,
  updateOrderStatus,
} from '../lib/storage';
import { ClientAccount, CustomerOrder } from '../types';
import { QrCodeDisplay } from './QrCodeDisplay';
import { OrderStatusLabel } from './StatusIndicator';

type ModalStep =
  | 'choose_method'
  | 'qr_pay'
  | 'upi_waiting'
  | 'upi_return_confirm'
  | 'not_confirmed'
  | 'confirmed';

interface CheckoutSandboxProps {
  client: ClientAccount;
  orders: CustomerOrder[];
  effectiveAdminPin: string;
  onRefresh: () => void;
}

export function CheckoutSandbox({
  client,
  orders,
  effectiveAdminPin,
  onRefresh,
}: CheckoutSandboxProps) {
  const gateway = client.gatewayConfig;
  const [testPriceInput, setTestPriceInput] = useState('₹1,499');

  // Checkout Modal State
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('choose_method');
  const [modalAmount, setModalAmount] = useState(0);
  const [modalOrderId, setModalOrderId] = useState('');
  const [utrInput, setUtrInput] = useState('');
  const [appUtrInput, setAppUtrInput] = useState('');
  const [utrError, setUtrError] = useState('');
  const [submittedOrder, setSubmittedOrder] = useState<CustomerOrder | null>(null);
  const [confirmedMsg, setConfirmedMsg] = useState('');
  const [sandboxError, setSandboxError] = useState('');

  // Hidden Business Admin Modal State
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setCheckoutOpen(false);
        setAdminOpen(true);
        setPinError('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!checkoutOpen || modalStep !== 'upi_waiting') return;
    const onReturn = () => {
      if (document.visibilityState === 'visible') {
        setModalStep('upi_return_confirm');
      }
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [checkoutOpen, modalStep]);

  if (!gateway) return null;

  const brandColor = gateway.accentColor || '#0F766E';

  const parseDisplayedAmount = (raw: string): number => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return !Number.isNaN(num) && num > 0 ? num : 0;
  };

  const parsedPreviewAmount = parseDisplayedAmount(testPriceInput);

  const handleSimulatedCheckoutClick = () => {
    setSandboxError('');
    const totalEl = document.getElementById('sandbox-checkout-total');
    const rawText = totalEl?.textContent || testPriceInput;
    const readAmount = parseDisplayedAmount(rawText);

    if (!readAmount) {
      setSandboxError('Enter a valid payable amount above (e.g. ₹1,499 or 999).');
      return;
    }

    const generatedOrder = `ORD-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
    setModalAmount(readAmount);
    setModalOrderId(generatedOrder);
    setUtrInput('');
    setAppUtrInput('');
    setUtrError('');
    setSubmittedOrder(null);
    setConfirmedMsg('');
    setModalStep('choose_method');
    setAdminOpen(false);
    setCheckoutOpen(true);
  };

  const modalUpiUri =
    modalAmount > 0
      ? buildUpiIntentUri({
          pa: gateway.upiId,
          pn: client.entityName,
          am: modalAmount,
          tn: modalOrderId,
        })
      : '';

  const handleLaunchUpiApp = () => {
    setModalStep('upi_waiting');
    if (modalUpiUri) {
      try {
        window.location.href = modalUpiUri;
      } catch {
        // Ignore browser scheme blocking in desktop preview
      }
    }
  };

  const handleQrUtrSubmit = (e: FormEvent) => {
    e.preventDefault();
    setUtrError('');
    const cleaned = utrInput.replace(/\s+/g, '').toUpperCase();
    if (!isValidUtr(cleaned)) {
      setUtrError('Please enter a valid alphanumeric UTR (8–32 chars, e.g. 412345678901 or FP2611268901).');
      return;
    }
    const created = createCustomerOrder({
      clientId: client.id,
      clientSlug: client.slug,
      orderId: modalOrderId,
      amount: modalAmount,
      utr: cleaned,
      customerName: 'Sandbox Test Shopper',
      customerNote: 'Paid via QR',
    });
    setSubmittedOrder(created);
    setConfirmedMsg('Your UTR reference has been recorded. Verification may take up to 24 hours.');
    setModalStep('confirmed');
    onRefresh();
  };

  const handleUpiAppConfirm = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = appUtrInput.replace(/\s+/g, '').toUpperCase();
    const created = createCustomerOrder({
      clientId: client.id,
      clientSlug: client.slug,
      orderId: modalOrderId,
      amount: modalAmount,
      utr: isValidUtr(cleaned) ? cleaned : 'UPI-APP-PAID',
      customerName: 'Sandbox Test Shopper',
      customerNote: 'Paid via UPI App',
    });
    setSubmittedOrder(created);
    setConfirmedMsg('Payment confirmed via UPI App. Returning you to the merchant page.');
    setModalStep('confirmed');
    onRefresh();
  };

  const handleOpenHiddenAdmin = () => {
    setCheckoutOpen(false);
    setAdminOpen(true);
    setAdminUnlocked(false);
    setPinInput('');
    setPinError('');
  };

  const handleVerifyAdminPin = (e: FormEvent) => {
    e.preventDefault();
    if (pinInput === effectiveAdminPin) {
      setAdminUnlocked(true);
      setPinError('');
    } else {
      setPinError('Incorrect Business Admin PIN.');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Test Your Checkout Code
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Simulate your website&apos;s cart total, click Final Checkout to test Pay via QR or Pay via UPI App, and test unlocking your hidden Business Admin panel.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenHiddenAdmin}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Test Hidden Admin (Ctrl+Shift+A)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sandbox-price-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Test Cart Total Text (with ₹ or commas)
              </label>
              <input
                id="sandbox-price-input"
                type="text"
                value={testPriceInput}
                onChange={(e) => setTestPriceInput(e.target.value)}
                placeholder="₹1,499"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1.5">
                Auto-Parsed Numeric Amount
              </p>
              <div className="px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 tabular-nums">
                {parsedPreviewAmount > 0 ? formatInr(parsedPreviewAmount) : 'Invalid amount'}
              </div>
            </div>
          </div>

          {sandboxError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
              {sandboxError}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <ShoppingCart className="w-3.5 h-3.5" />
              Simulated Storefront Cart
            </span>
            <span className="font-mono text-[11px] text-slate-400">id=&quot;checkout-total&quot;</span>
          </div>

          <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
            <span className="text-sm font-medium text-slate-700">Order Total</span>
            <span
              id="sandbox-checkout-total"
              className="font-mono text-xl font-bold text-slate-900 tabular-nums"
            >
              {testPriceInput || '₹0'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSimulatedCheckoutClick}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90 cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: brandColor }}
          >
            <Play className="w-3.5 h-3.5" />
            Final Checkout
          </button>
        </div>
      </div>

      {checkoutOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          onClick={() => setCheckoutOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="h-1.5 w-full"
              style={{
                backgroundColor: modalStep === 'not_confirmed' ? '#DC2626' : brandColor,
              }}
            />
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    {modalStep === 'not_confirmed'
                      ? 'Order Not Confirmed'
                      : client.entityName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">
                    Direct UPI Checkout · {modalOrderId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(false)}
                  aria-label="Close modal"
                  className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modalStep !== 'confirmed' && modalStep !== 'not_confirmed' && (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-xs font-semibold text-slate-600">Payable Amount</span>
                  <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                    {formatInr(modalAmount)}
                  </span>
                </div>
              )}

              {modalStep === 'choose_method' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-700">
                    Choose how you want to pay:
                  </p>

                  <button
                    type="button"
                    onClick={() => setModalStep('qr_pay')}
                    className="w-full text-left p-4 bg-white border border-slate-200 hover:border-slate-900 rounded-xl transition-colors cursor-pointer flex items-start gap-3.5"
                  >
                    <QrCode className="w-5 h-5 text-slate-800 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">Pay through QR Code</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Scan QR code and enter your UPI UTR / Ref ID (verification may take up to 24 hrs)
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleLaunchUpiApp}
                    className="w-full text-left p-4 bg-white border border-slate-200 hover:border-slate-900 rounded-xl transition-colors cursor-pointer flex items-start gap-3.5"
                  >
                    <Smartphone className="w-5 h-5 text-slate-800 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">Pay through UPI App</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Open GPay, PhonePe, Paytm, or FamPay directly on your phone
                      </p>
                    </div>
                  </button>
                </div>
              )}

              {modalStep === 'qr_pay' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setModalStep('choose_method')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Change Payment Method
                  </button>

                  <div className="flex flex-col items-center">
                    <QrCodeDisplay
                      value={modalUpiUri}
                      staticImageUrl={gateway.staticQrDataUrl}
                      size={185}
                      accentColor={brandColor}
                      label={`UPI ID: ${gateway.upiId}`}
                    />
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                    <strong>Note:</strong> After paying via QR, enter your UPI UTR / Reference Number below. Verification may take up to <strong>24 hours</strong>.
                  </div>

                  <form
                    onSubmit={handleQrUtrSubmit}
                    className="pt-2 border-t border-slate-200 space-y-3"
                  >
                    <div>
                      <label
                        htmlFor="sandbox-utr-input"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        UPI UTR / Reference Number (Varchar)
                      </label>
                      <input
                        id="sandbox-utr-input"
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
                        className="w-full px-3.5 py-2 text-sm font-mono uppercase bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 tabular-nums"
                      />
                    </div>
                    {utrError && (
                      <p className="text-xs text-red-600 font-medium">{utrError}</p>
                    )}
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 text-xs font-semibold text-white rounded-lg cursor-pointer"
                      style={{ backgroundColor: brandColor }}
                    >
                      Submit UTR &amp; Place Order
                    </button>
                  </form>
                </div>
              )}

              {modalStep === 'upi_waiting' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                    <p className="text-sm font-bold text-slate-900">Opening your UPI app...</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Complete the {formatInr(modalAmount)} payment in your UPI app and return here. If your app did not open automatically, tap below.
                    </p>
                  </div>

                  <a
                    href={modalUpiUri}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg"
                    style={{ backgroundColor: brandColor }}
                  >
                    <Smartphone className="w-4 h-4" />
                    Open UPI App Again
                  </a>

                  <button
                    type="button"
                    onClick={() => setModalStep('upi_return_confirm')}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    I Returned From UPI App
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalStep('not_confirmed')}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer"
                  >
                    Cancel / Payment Not Done
                  </button>
                </div>
              )}

              {modalStep === 'upi_return_confirm' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900">
                      Did you complete the payment in your UPI app?
                    </p>
                    <p className="text-xs text-slate-500">
                      Confirm your payment status to return to the page.
                    </p>
                  </div>

                  <form onSubmit={handleUpiAppConfirm} className="space-y-3">
                    <div>
                      <label
                        htmlFor="sandbox-app-utr"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        UPI UTR / Ref ID (Optional if paid via UPI app)
                      </label>
                      <input
                        id="sandbox-app-utr"
                        type="text"
                        maxLength={32}
                        value={appUtrInput}
                        onChange={(e) =>
                          setAppUtrInput(
                            e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 32)
                          )
                        }
                        placeholder="Optional UTR / Ref ID"
                        className="w-full px-3.5 py-2 text-sm font-mono uppercase bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 tabular-nums"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 text-xs font-semibold text-white rounded-lg cursor-pointer"
                      style={{ backgroundColor: brandColor }}
                    >
                      Yes, Payment Completed
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={() => setModalStep('not_confirmed')}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer"
                  >
                    No, Payment Not Done
                  </button>
                </div>
              )}

              {modalStep === 'not_confirmed' && (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Payment was not completed in your UPI app, so this order is <strong>not confirmed</strong>. No order was placed.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleLaunchUpiApp}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white rounded-lg cursor-pointer"
                    style={{ backgroundColor: brandColor }}
                  >
                    Retry via UPI App
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalStep('qr_pay')}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    Pay through QR Code Instead
                  </button>
                </div>
              )}

              {modalStep === 'confirmed' && submittedOrder && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2 text-xs text-emerald-900">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      Order Reference Recorded
                    </div>
                    <p>
                      Order <span className="font-mono font-semibold">{submittedOrder.orderId}</span> ({formatInr(submittedOrder.amount)}) · Reference: <span className="font-mono font-semibold">{submittedOrder.utr}</span>.
                    </p>
                    <p>{confirmedMsg}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleOpenHiddenAdmin}
                      className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      Open Hidden Admin to Verify
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutOpen(false)}
                      className="py-2.5 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Back to Page
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {adminOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          onClick={() => setAdminOpen(false)}
        >
          <div
            className={`bg-white border border-slate-200 rounded-xl w-full overflow-hidden shadow-xl max-h-[92vh] overflow-y-auto ${
              adminUnlocked ? 'max-w-2xl' : 'max-w-md'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full" style={{ backgroundColor: brandColor }} />
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                    <ShieldCheck className="w-4 h-4" />
                    Hidden Business Admin Preview
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                    {adminUnlocked
                      ? `Order Verification · ${client.entityName}`
                      : 'Enter Secret Business Admin PIN'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminOpen(false)}
                  aria-label="Close modal"
                  className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!adminUnlocked ? (
                <form onSubmit={handleVerifyAdminPin} className="space-y-4">
                  <div>
                    <label
                      htmlFor="sandbox-admin-pin"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Business Admin PIN / Password
                    </label>
                    <div className="relative">
                      <input
                        id="sandbox-admin-pin"
                        type={showPin ? 'text' : 'password'}
                        required
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        placeholder="Enter your Secret Business Admin PIN"
                        className="w-full pr-10 pl-3.5 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        aria-label="Toggle PIN visibility"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {pinError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
                      {pinError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 text-sm font-semibold text-white rounded-lg cursor-pointer"
                    style={{ backgroundColor: brandColor }}
                  >
                    Unlock Order Verification Panel
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">
                    Cross-check each UTR / Ref ID against your UPI/FamPay history before confirming.
                  </p>
                  {orders.length === 0 ? (
                    <div className="p-8 text-center border border-slate-200 rounded-lg text-xs text-slate-500">
                      No orders submitted yet. Click Final Checkout in the sandbox and submit a test payment first.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                            <th className="py-2.5 px-3">Order ID</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                            <th className="py-2.5 px-3">UTR / Ref ID</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {orders.map((order) => (
                            <tr key={order.id}>
                              <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                                {order.orderId}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                                {formatInr(order.amount)}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-700 tabular-nums">
                                {order.utr}
                              </td>
                              <td className="py-2.5 px-3">
                                <OrderStatusLabel status={order.status} />
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {order.status !== 'APPROVED' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateOrderStatus(order.id, 'APPROVED');
                                      onRefresh();
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded cursor-pointer whitespace-nowrap"
                                  >
                                    Confirm &amp; Approve Order
                                  </button>
                                ) : (
                                  <span className="text-slate-400">Verified</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
