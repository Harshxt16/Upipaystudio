import { ClientAccount } from '../types';

interface TopNavProps {
  currentClient: ClientAccount | null;
  activeView: 'landing' | 'dashboard' | 'admin';
  onNavigateLanding: () => void;
  onNavigateDashboard: () => void;
  onScrollToAuth?: () => void;
  onLogout?: () => void;
}

export function TopNav({
  currentClient,
  activeView,
  onNavigateLanding,
  onNavigateDashboard,
  onScrollToAuth,
  onLogout,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={onNavigateLanding}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer hover:text-teal-700 transition-colors"
        >
          UPIPay Studio
        </button>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {activeView === 'landing' ? (
            <>
              <a
                href="#architecture"
                className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                How It Works
              </a>
              <a
                href="#checkout-features"
                className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Gateway Features
              </a>
              <a
                href="#pricing"
                className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Lifetime Plan
              </a>
            </>
          ) : (
            <button
              type="button"
              onClick={onNavigateLanding}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Overview
            </button>
          )}

          {currentClient && (
            <button
              type="button"
              onClick={onNavigateDashboard}
              className={`hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'dashboard' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              Merchant Studio
            </button>
          )}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {currentClient ? (
            activeView === 'dashboard' && onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={onNavigateDashboard}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Dashboard
              </button>
            )
          ) : activeView === 'admin' ? (
            <button
              type="button"
              onClick={onNavigateLanding}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Merchant Sign In
            </button>
          ) : (
            <button
              type="button"
              onClick={onScrollToAuth}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Create Gateway
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
