import { ClientAccount, CustomerOrder, GatewayConfig, OrderStatus } from '../types';

const CLIENTS_KEY = 'upipay_studio_clients_v1';
const ORDERS_KEY = 'upipay_studio_orders_v1';
const SESSION_CLIENT_KEY = 'upipay_studio_current_client_id';
const ADMIN_AUTH_KEY = 'upipay_studio_admin_authed';

const SYNC_EVENT = 'upipay_studio_data_updated';

function emitSync(): void {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

export function subscribeToStorageSync(callback: () => void): () => void {
  const onCustom = () => callback();
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === CLIENTS_KEY ||
      e.key === ORDERS_KEY ||
      e.key === SESSION_CLIENT_KEY
    ) {
      callback();
    }
  };
  window.addEventListener(SYNC_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(SYNC_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

export function getClients(): ClientAccount[] {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveClients(clients: ClientAccount[]): void {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  emitSync();
}

export function getOrders(): CustomerOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOrders(orders: CustomerOrder[]): void {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  emitSync();
}

export function getCurrentClientId(): string | null {
  return localStorage.getItem(SESSION_CLIENT_KEY);
}

export function setCurrentClientId(clientId: string | null): void {
  if (clientId) {
    localStorage.setItem(SESSION_CLIENT_KEY, clientId);
  } else {
    localStorage.removeItem(SESSION_CLIENT_KEY);
  }
  emitSync();
}

export function getCurrentClient(): ClientAccount | null {
  const id = getCurrentClientId();
  if (!id) return null;
  return getClients().find((c) => c.id === id) ?? null;
}

export function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true';
}

export function setAdminAuthenticated(authed: boolean): void {
  if (authed) {
    sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
  } else {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
  }
}

export function generateUniqueSlug(entityName: string, existingClients: ClientAccount[]): string {
  const base = entityName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'merchant';

  const existingSlugs = new Set(existingClients.map((c) => c.slug));
  if (!existingSlugs.has(base)) return base;

  let counter = 2;
  while (existingSlugs.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

export function generateClientId(): string {
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  const timePart = Date.now().toString(36).slice(-4).toUpperCase();
  return `UP${timePart}${randomPart}`;
}

export function registerClient(input: {
  fullName: string;
  entityName: string;
  email: string;
  password: string;
}): { ok: true; client: ClientAccount } | { ok: false; error: string } {
  const clients = getClients();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (clients.some((c) => c.email.toLowerCase() === normalizedEmail)) {
    return { ok: false, error: 'An account with this email address already exists.' };
  }

  const newClient: ClientAccount = {
    id: generateClientId(),
    slug: generateUniqueSlug(input.entityName, clients),
    fullName: input.fullName.trim(),
    entityName: input.entityName.trim(),
    email: normalizedEmail,
    password: input.password,
    status: 'UNPAID',
    gatewayConfig: null,
    createdAt: new Date().toISOString(),
  };

  saveClients([newClient, ...clients]);
  setCurrentClientId(newClient.id);
  return { ok: true, client: newClient };
}

export function loginClient(
  email: string,
  password: string
): { ok: true; client: ClientAccount } | { ok: false; error: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const clients = getClients();
  const match = clients.find(
    (c) => c.email.toLowerCase() === normalizedEmail && c.password === password
  );
  if (!match) {
    return { ok: false, error: 'Invalid email address or password.' };
  }
  setCurrentClientId(match.id);
  return { ok: true, client: match };
}

export function updateClientGatewayConfig(
  clientId: string,
  config: GatewayConfig
): ClientAccount | null {
  const clients = getClients();
  let updated: ClientAccount | null = null;
  const next = clients.map((c) => {
    if (c.id !== clientId) return c;
    updated = {
      ...c,
      gatewayConfig: {
        ...config,
        configuredAt: new Date().toISOString(),
      },
    };
    return updated;
  });
  saveClients(next);
  return updated;
}

export function submitActivationUtr(
  clientId: string,
  utr: string
): ClientAccount | null {
  const clients = getClients();
  let updated: ClientAccount | null = null;
  const next = clients.map((c) => {
    if (c.id !== clientId) return c;
    updated = {
      ...c,
      activationUtr: utr.trim(),
      activationSubmittedAt: new Date().toISOString(),
      status: 'PENDING_VERIFICATION',
      rejectedReason: undefined,
    };
    return updated;
  });
  saveClients(next);
  return updated;
}

export function adminApproveClient(clientId: string): ClientAccount | null {
  const clients = getClients();
  let updated: ClientAccount | null = null;
  const next = clients.map((c) => {
    if (c.id !== clientId) return c;
    updated = {
      ...c,
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      rejectedReason: undefined,
    };
    return updated;
  });
  saveClients(next);
  return updated;
}

export function adminRejectClient(clientId: string, reason?: string): ClientAccount | null {
  const clients = getClients();
  let updated: ClientAccount | null = null;
  const next = clients.map((c) => {
    if (c.id !== clientId) return c;
    updated = {
      ...c,
      status: 'REJECTED',
      rejectedReason: reason?.trim() || 'UTR could not be verified against FamPay history.',
    };
    return updated;
  });
  saveClients(next);
  return updated;
}

export function getClientBySlug(slug: string): ClientAccount | null {
  const normalized = slug.trim().toLowerCase();
  return getClients().find((c) => c.slug.toLowerCase() === normalized) ?? null;
}

export function createCustomerOrder(input: {
  clientId: string;
  clientSlug: string;
  orderId: string;
  amount: number;
  utr: string;
  customerName?: string;
  customerNote?: string;
}): CustomerOrder {
  const orders = getOrders();
  const now = new Date().toISOString();
  const order: CustomerOrder = {
    id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    clientId: input.clientId,
    clientSlug: input.clientSlug,
    orderId: input.orderId.trim(),
    amount: input.amount,
    utr: input.utr.trim(),
    customerName: input.customerName?.trim() || undefined,
    customerNote: input.customerNote?.trim() || undefined,
    status: 'PENDING_VERIFICATION',
    createdAt: now,
    updatedAt: now,
  };
  saveOrders([order, ...orders]);
  return order;
}

export function updateOrderStatus(orderRecordId: string, status: OrderStatus): CustomerOrder | null {
  const orders = getOrders();
  let updated: CustomerOrder | null = null;
  const next = orders.map((o) => {
    if (o.id !== orderRecordId) return o;
    updated = {
      ...o,
      status,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });
  saveOrders(next);
  return updated;
}

export function getOrdersForClient(clientId: string): CustomerOrder[] {
  return getOrders().filter((o) => o.clientId === clientId);
}

export function isValidUpiId(upi: string): boolean {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(upi.trim());
}

export function isValidUtr(utr: string): boolean {
  return /^\d{12}$/.test(utr.trim());
}

export function isValidOptionalUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildUpiIntentUri(params: {
  pa: string;
  pn: string;
  am?: number;
  tn?: string;
  tr?: string;
}): string {
  const search = new URLSearchParams();
  search.set('pa', params.pa.trim());
  search.set('pn', params.pn.trim());
  if (params.am !== undefined && params.am > 0) {
    search.set('am', Number(params.am.toFixed(2)).toString());
  }
  search.set('cu', 'INR');
  if (params.tn?.trim()) {
    search.set('tn', params.tn.trim());
  }
  if (params.tr?.trim()) {
    search.set('tr', params.tr.trim());
  }
  return `upi://pay?${search.toString()}`;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function buildGatewayUrl(params: {
  slug: string;
  amount?: number;
  orderId?: string;
}): string {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('gateway', params.slug);
  if (params.amount && params.amount > 0) {
    url.searchParams.set('amount', String(params.amount));
  }
  if (params.orderId?.trim()) {
    url.searchParams.set('order_id', params.orderId.trim());
  }
  return url.toString();
}

export function exportOrdersCsv(orders: CustomerOrder[], entityName: string): void {
  const headers = ['Order ID', 'Amount (INR)', '12-Digit UTR', 'Customer', 'Note', 'Status', 'Submitted At'];
  const rows = orders.map((o) => [
    o.orderId,
    o.amount.toFixed(2),
    o.utr,
    o.customerName || '',
    o.customerNote || '',
    o.status,
    o.createdAt,
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${entityName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-orders.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
