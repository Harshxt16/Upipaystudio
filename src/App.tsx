import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { ClientDashboard } from './components/ClientDashboard';
import { LandingAuthView } from './components/LandingAuthView';
import { PublicGatewayView } from './components/PublicGatewayView';
import { TopNav } from './components/TopNav';
import {
  getClients,
  getCurrentClient,
  getOrdersForClient,
  setCurrentClientId,
  subscribeToStorageSync,
} from './lib/storage';
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
      amount: parsedAmount && !Number.isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined,
      orderId,
      embed,
    };
  }

  const view = params.get('view');
  if (view === 'admin') {
    return { type: 'admin' };
  }

  if (getCurrentClient()) {
    return { type: 'dashboard' };
  }

  return { type: 'landing' };
}

export default function App() {
  const [route, setRoute] = useState<AppView>(() => parseRouteFromUrl());
  const [clients, setClients] = useState<ClientAccount[]>(() => getClients());
  const [currentClient, setCurrentClient] = useState<ClientAccount | null>(() =>
    getCurrentClient()
  );
  const [clientOrders, setClientOrders] = useState<CustomerOrder[]>(() => {
    const c = getCurrentClient();
    return c ? getOrdersForClient(c.id) : [];
  });

  const refreshData = useCallback(() => {
    const nextClients = getClients();
    const nextCurrent = getCurrentClient();
    setClients(nextClients);
    setCurrentClient(nextCurrent);
    setClientOrders(nextCurrent ? getOrdersForClient(nextCurrent.id) : []);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToStorageSync(refreshData);
    const onPopState = () => {
      refreshData();
      setRoute(parseRouteFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      unsubscribe();
      window.removeEventListener('popstate', onPopState);
    };
  }, [refreshData]);

  const navigateUrl = (searchParams: Record<string, string | undefined>, nextRoute: AppView) => {
    const url = new URL(window.location.origin + window.location.pathname);
    Object.entries(searchParams).forEach(([key, val]) => {
      if (val) url.searchParams.set(key, val);
    });
    window.history.pushState({}, '', url.toString());
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
    if (getCurrentClient()) {
      navigateUrl({}, { type: 'dashboard' });
    } else {
      navigateUrl({}, { type: 'landing' });
    }
  };

  const handleNavigateAdmin = () => {
    navigateUrl({ view: 'admin' }, { type: 'admin' });
  };

  const handleLogout = () => {
    setCurrentClientId(null);
    refreshData();
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
          refreshData();
          if (getCurrentClient()) {
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
      : route.type === 'dashboard' && currentClient
      ? 'dashboard'
      : 'landing';

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

      {resolvedView === 'admin' && (
        <AdminDashboard
          clients={clients}
          onRefresh={refreshData}
          onOpenGateway={(slug) => handleOpenLiveGateway(slug)}
        />
      )}

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
          onAuthenticated={(client) => {
            refreshData();
            setCurrentClient(client);
            navigateUrl({}, { type: 'dashboard' });
          }}
          onOpenAdmin={handleNavigateAdmin}
        />
      )}
    </div>
  );
}
