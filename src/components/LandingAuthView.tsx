import { FormEvent, useState } from 'react';
import { ArrowRight, Check, Lock, QrCode, ShieldCheck, Smartphone, ClipboardList } from 'lucide-react';
import { loginClient, registerClient } from '../lib/storage';
import { ClientAccount } from '../types';
import { PLATFORM_OWNER_CONFIG } from '../config/platform';

interface LandingAuthViewProps {
  onAuthenticated: (client: ClientAccount) => void;
  onOpenAdmin: () => void;
}

export function LandingAuthView({ onAuthenticated, onOpenAdmin }: LandingAuthViewProps) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [fullName, setFullName] = useState('');
  const [entityName, setEntityName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (fullName.trim().length < 2) {
        setError('Please enter your full name.');
        return;
      }
      if (entityName.trim().length < 2) {
        setError('Please enter your business or entity name.');
        return;
      }
      if (!email.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      const res = registerClient({ fullName, entityName, email, password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onAuthenticated(res.client);
    } else {
      const res = loginClient(email, password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onAuthenticated(res.client);
    }
  };

  return (
    <main className="bg-slate-50">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-16 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start">
          <div className="lg:col-span-7 space-y-8 pt-2">
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-wide text-teal-700">
                Direct-to-Bank UPI Checkout · Zero Transaction Commission
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance] max-w-2xl">
                Host your own Direct UPI Payment Gateway in minutes.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                Accept instant UPI payments from customers via dynamic QR codes and mobile intent deep-links straight into your FamPay, GPay, PhonePe, or bank UPI ID. Pay once, own your checkout link forever.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 border-t border-slate-200">
              <div className="pt-4">
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">₹499</p>
                <p className="text-xs text-slate-500 mt-1">One-time lifetime setup fee</p>
              </div>
              <div className="pt-4">
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">0%</p>
                <p className="text-xs text-slate-500 mt-1">Platform commission on orders</p>
              </div>
              <div className="pt-4">
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">12-Digit</p>
                <p className="text-xs text-slate-500 mt-1">UTR verification workflow</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href="#auth-panel"
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Launch Your Gateway
                <ArrowRight className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:text-slate-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Lock className="w-4 h-4 text-slate-500" />
                Platform Owner Admin
              </button>
            </div>
          </div>

          <div
            id="auth-panel"
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8"
          >
            <div className="flex items-center justify-between gap-4 pb-6 border-b border-slate-200">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {mode === 'signup' ? 'Create Merchant Account' : 'Merchant Sign In'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {mode === 'signup'
                    ? 'Register your business to configure your UPI gateway'
                    : 'Access your gateway settings and incoming orders'}
                </p>
              </div>

              <div className="flex items-center p-1 bg-slate-100 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    mode === 'signup'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Log In
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'signup' && (
                <>
                  <div>
                    <label
                      htmlFor="full-name"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Full Name
                    </label>
                    <input
                      id="full-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Aarav Mehta"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="entity-name"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Entity / Business Name
                    </label>
                    <input
                      id="entity-name"
                      type="text"
                      required
                      value={entityName}
                      onChange={(e) => setEntityName(e.target.value)}
                      placeholder="PixelCraft Digital Studio"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="email-address"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="email-address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@pixelcraft.in"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Minimum 6 characters' : 'Enter your password'}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {mode === 'signup' ? 'Continue to Gateway Setup' : 'Sign In to Workspace'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section id="architecture" className="border-t border-slate-200 bg-white py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
              Three steps from sign-up to live UPI checkout
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Every payment routes straight to your own UPI handle with verifiable 12-digit UTR logs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 border border-slate-200 rounded-xl bg-slate-50/50">
              <p className="font-mono text-xs font-semibold text-teal-700 mb-3">01. Configure</p>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Set your UPI ID & branding
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Enter your merchant UPI ID, display name, brand accent color, optional static QR image, and post-payment redirect URL.
              </p>
            </div>

            <div className="p-6 border border-slate-200 rounded-xl bg-slate-50/50">
              <p className="font-mono text-xs font-semibold text-teal-700 mb-3">02. Activate</p>
              <h3 className="font-display text-lg font-bold text-slate-900">
                One-time ₹499 lifetime unlock
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Pay ₹499 once via UPI to {PLATFORM_OWNER_CONFIG.payeeName} and submit your 12-digit UTR for admin verification.
              </p>
            </div>

            <div className="p-6 border border-slate-200 rounded-xl bg-slate-50/50">
              <p className="font-mono text-xs font-semibold text-teal-700 mb-3">03. Receive &amp; Launch</p>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Get editable code or a readymade app
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Provide your email to receive a personalized, editable UPI gateway code setup for your own app—or request a readymade setup with zero embeds required.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="checkout-features" className="border-t border-slate-200 bg-slate-50 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
                Built for desktop QR scanners and mobile UPI intent
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
                Your customers get a friction-free checkout screen tailored with your business name and accent palette—whether they scan on desktop or tap to open their UPI app on mobile.
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-5 bg-white border border-slate-200 rounded-xl">
                <QrCode className="w-5 h-5 text-teal-700 mb-3" />
                <h3 className="font-display text-base font-bold text-slate-900">
                  Dynamic & Static QR Support
                </h3>
                <p className="text-sm text-slate-600 mt-1.5">
                  Automatically embeds exact order amounts and order IDs into scannable UPI QR codes, or uses your uploaded static QR.
                </p>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-xl">
                <Smartphone className="w-5 h-5 text-teal-700 mb-3" />
                <h3 className="font-display text-base font-bold text-slate-900">
                  One-Tap Mobile Deep Links
                </h3>
                <p className="text-sm text-slate-600 mt-1.5">
                  Launches GPay, PhonePe, Paytm, FamPay, or BHIM directly with pre-filled payee, amount, and order reference.
                </p>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-xl">
                <ClipboardList className="w-5 h-5 text-teal-700 mb-3" />
                <h3 className="font-display text-base font-bold text-slate-900">
                  Incoming Orders Ledger
                </h3>
                <p className="text-sm text-slate-600 mt-1.5">
                  Customers submit their 12-digit UTR right after paying so you can verify and approve orders with CSV export.
                </p>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-teal-700 mb-3" />
                <h3 className="font-display text-base font-bold text-slate-900">
                  Editable Code or Readymade Setup
                </h3>
                <p className="text-sm text-slate-600 mt-1.5">
                  Receive your standalone HTML/React gateway source code by email to customize inside your own app, or request a personalized readymade setup.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-slate-200 bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border border-slate-200 rounded-xl p-8 sm:p-10 bg-slate-50/40 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-3 max-w-lg">
              <p className="text-xs font-semibold text-teal-700">
                Lifetime Merchant License
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                ₹499 once, zero recurring fees
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                For creators, indie makers, and growing businesses who want direct UPI settlement with full ownership of their checkout code.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-700 shrink-0" />
                  Editable HTML &amp; React code setup
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-700 shrink-0" />
                  Readymade setup delivered by email
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-700 shrink-0" />
                  Custom brand accent &amp; redirect
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-700 shrink-0" />
                  Incoming order UTR dashboard
                </li>
              </ul>
            </div>

            <div className="shrink-0 border-t md:border-t-0 md:border-l border-slate-200 pt-6 md:pt-0 md:pl-8 flex flex-col items-start md:items-end">
              <p className="font-mono text-4xl font-bold text-slate-900 tabular-nums">₹499</p>
              <p className="text-xs text-slate-500 mt-1 mb-5">One-time via UPI</p>
              <a
                href="#auth-panel"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                Register Your Business
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>UPIPay Studio · Direct UPI Gateway Infrastructure</p>
          <div className="flex items-center gap-6">
            <a href="#auth-panel" className="hover:text-slate-900 transition-colors">
              Merchant Portal
            </a>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Owner Admin
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
