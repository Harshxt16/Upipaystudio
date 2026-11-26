import { Component, ReactNode, useCallback, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { AdminDashboard } from './components/AdminDashboard';
import { ClientDashboard } from './components/ClientDashboard';
import { LandingAuthView } from './components/LandingAuthView';
import { PublicGatewayView } from './components/PublicGatewayView';
import { TopNav } from './components/TopNav';
import { auth } from './lib/firebase';
import { subscribeClientAccount, subscribeOrdersForClient } from './lib/storage';
import { AppView, ClientAccount, CustomerOrder } from './types';

function parseRouteFromUrl(): AppView {
  const params = new URLSearchParams(window.location.search);
  const gatewaySlug = params.get('gateway');
  if (gatewaySlug && gatewaySlug.trim()) {
    const rawAmount = params.get('amount');
    const parsedAmount = rawAmount ? Number(rawAmount) : undefined;
    const orderId = params.get('order_id') || undefined;
    const embed = params.get('embed') === '1';
    return {
      type: 'gateway',
      slug: gatewaySlug.trim(),
      amount:
        parsedAmount && !Number.isNaN(parsedAmount) && parsedAmount > 0
          ? parsedAmount
          : undefined,
      orderId,
      embed,
    };
  }

  const view = params.get('view');
  if (view === 'admin') {
    return { type: 'admin' };
  }

  return { type: 'landing' };
}

export default function App() {
  const [route, setRoute] = useState<AppView>(() => parseRouteFromUrl());
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentClient, setCurrentClient] = useState<ClientAccount | null>(null);
  const [clientResolved, setClientResolved] = useState(false);
  const [clientOrders, setClientOrders] = useState<CustomerOrder[]>([]);
  const [syncNonce, setSyncNonce] = useState(0);

  const refreshData = useCallback(() => {
    setSyncNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setCurrentClient(null);
        setClientOrders([]);
        setClientResolved(true);
      } else {
        setClientResolved(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !authUser) return;

    const unsubClient = subscribeClientAccount(
      authUser.uid,
      (client) => {
        setCurrentClient(client);
        setClientResolved(true);
      },
      () => {
        setClientResolved(true);
      }
    );

    return () => unsubClient();
  }, [authReady, authUser, syncNonce]);

  useEffect(() => {
    if (!authReady || !authUser || !currentClient) {
      setClientOrders([]);
      return;
    }

    const unsubOrders = subscribeOrdersForClient(
      currentClient.id,
      (orders) => setClientOrders(orders),
      () => setClientOrders([])
    );

    return () => unsubOrders();
  }, [authReady, authUser, currentClient?.id]);

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRouteFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateUrl = (searchParams: Record<string, string | undefined>, nextRoute: AppView) => {
    try {
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      Object.entries(searchParams).forEach(([key, val]) => {
        if (val) url.searchParams.set(key, val);
      });
      window.history.pushState({}, '', url.toString());
    } catch {
      // Fallback to in-memory route state if history API is restricted
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenLiveGateway = (slug: string, amount?: number, orderId?: string) => {
    navigateUrl(
      {
        gateway: slug,
        amount: amount && amount > 0 ? String(amount) : undefined,
        order_id: orderId?.trim() || undefined,
      },
      {
        type: 'gateway',
        slug,
        amount,
        orderId,
      }
    );
  };

  const handleNavigateLanding = () => {
    navigateUrl({}, { type: 'landing' });
  };

  const handleNavigateDashboard = () => {
    if (currentClient) {
      navigateUrl({}, { type: 'dashboard' });
    } else {
      navigateUrl({}, { type: 'landing' });
    }
  };

  const handleNavigateAdmin = () => {
    navigateUrl({ view: 'admin' }, { type: 'admin' });
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentClient(null);
    setClientOrders([]);
    navigateUrl({}, { type: 'landing' });
  };

  const handleScrollToAuth = () => {
    const el = document.getElementById('auth-panel');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (route.type === 'gateway') {
    return (
      <PublicGatewayView
        slug={route.slug}
        initialAmount={route.amount}
        initialOrderId={route.orderId}
        embed={route.embed}
        onExitGateway={() => {
          if (currentClient) {
            handleNavigateDashboard();
          } else {
            handleNavigateLanding();
          }
        }}
      />
    );
  }

  const resolvedView: 'landing' | 'dashboard' | 'admin' =
    route.type === 'admin'
      ? 'admin'
      : currentClient
      ? 'dashboard'
      : 'landing';

  const isLoadingSession = !authReady || (Boolean(authUser) && !clientResolved && resolvedView !== 'admin');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopNav
        currentClient={currentClient}
        activeView={resolvedView}
        onNavigateLanding={handleNavigateLanding}
        onNavigateDashboard={handleNavigateDashboard}
        onScrollToAuth={handleScrollToAuth}
        onLogout={handleLogout}
      />

      {isLoadingSession ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-sm font-medium text-slate-500">Connecting to UPIPay Studio...</p>
        </div>
      ) : (
        <>
          {resolvedView === 'admin' && <AdminDashboard authUser={authUser} />}

          {resolvedView === 'dashboard' && currentClient && (
            <ClientDashboard
              key={currentClient.id}
              client={currentClient}
              orders={clientOrders}
              onOpenLiveGateway={handleOpenLiveGateway}
              onRefresh={refreshData}
            />
          )}

          {resolvedView === 'landing' && (
            <LandingAuthView
              authUser={authUser}
              needsProfileCompletion={Boolean(authUser && clientResolved && !currentClient)}
              onAuthenticated={(client) => {
                setCurrentClient(client);
                navigateUrl({}, { type: 'dashboard' });
              }}
              onOpenAdmin={handleNavigateAdmin}
            />
          )}
        </>
      )}
    </div>
  );
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      let displayMsg =
        this.state.error.message || 'An unexpected error occurred while rendering this page.';
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed && typeof parsed.error === 'string') {
          displayMsg = parsed.error;
        }
      } catch {
        // Not a JSON FirestoreErrorInfo payload
      }
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h1 className="font-display text-lg font-bold text-slate-900">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-600 break-words">{displayMsg}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
                window.location.href = window.location.pathname;
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Reload UPIPay Studio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function RootApp() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
