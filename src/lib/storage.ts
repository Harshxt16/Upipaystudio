import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ClientAccount, CustomerOrder, GatewayConfig, OrderStatus } from '../types';
import { OperationType, db, handleFirestoreError } from './firebase';

const CLIENTS_KEY = 'upipay_studio_clients_v1';
const ORDERS_KEY = 'upipay_studio_orders_v1';
const ADMIN_AUTH_KEY = 'upipay_studio_admin_authed';

const memoryStorage = new Map<string, string>();

function safeGetLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStorage.get(key) ?? null;
  }
}

function safeSetLocal(key: string, value: string): void {
  memoryStorage.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in restricted iframes
  }
}

function safeGetSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return memoryStorage.get(`session:${key}`) ?? null;
  }
}

function safeSetSession(key: string, value: string): void {
  memoryStorage.set(`session:${key}`, value);
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage errors
  }
}

function safeRemoveSession(key: string): void {
  memoryStorage.delete(`session:${key}`);
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function mapClientDoc(id: string, data: Record<string, unknown>): ClientAccount {
  return {
    id,
    uid: typeof data.uid === 'string' ? data.uid : id,
    merchantCode: typeof data.merchantCode === 'string' ? data.merchantCode : id.slice(0, 8).toUpperCase(),
    slug: typeof data.slug === 'string' ? data.slug : 'merchant',
    fullName: typeof data.fullName === 'string' ? data.fullName : '',
    entityName: typeof data.entityName === 'string' ? data.entityName : '',
    email: typeof data.email === 'string' ? data.email : '',
    status: (data.status as ClientAccount['status']) || 'UNPAID',
    gatewayConfig: (data.gatewayConfig as GatewayConfig | null) ?? null,
    activationUtr: typeof data.activationUtr === 'string' ? data.activationUtr : undefined,
    activationSubmittedAt:
      typeof data.activationSubmittedAt === 'string' ? data.activationSubmittedAt : undefined,
    activatedAt: typeof data.activatedAt === 'string' ? data.activatedAt : undefined,
    rejectedReason: typeof data.rejectedReason === 'string' ? data.rejectedReason : undefined,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: data.updatedAt ? timestampToIso(data.updatedAt) : undefined,
  };
}

function mapOrderDoc(id: string, data: Record<string, unknown>): CustomerOrder {
  return {
    id,
    clientId: typeof data.clientId === 'string' ? data.clientId : '',
    clientSlug: typeof data.clientSlug === 'string' ? data.clientSlug : '',
    orderId: typeof data.orderId === 'string' ? data.orderId : '',
    amount: typeof data.amount === 'number' ? data.amount : 0,
    utr: typeof data.utr === 'string' ? data.utr : '',
    customerName: typeof data.customerName === 'string' ? data.customerName : undefined,
    customerNote: typeof data.customerNote === 'string' ? data.customerNote : undefined,
    status: (data.status as OrderStatus) || 'PENDING_VERIFICATION',
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export function isAdminAuthenticated(): boolean {
  return safeGetSession(ADMIN_AUTH_KEY) === 'true';
}

export function setAdminAuthenticated(authed: boolean): void {
  if (authed) {
    safeSetSession(ADMIN_AUTH_KEY, 'true');
  } else {
    safeRemoveSession(ADMIN_AUTH_KEY);
  }
}

export function generateSafeSlug(entityName: string, uid: string): string {
  const base =
    entityName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72) || 'merchant';
  const suffix = uid
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 6);
  return `${base}-${suffix || 'gw'}`.slice(0, 100);
}

export function generateMerchantCode(): string {
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  const timePart = Date.now().toString(36).slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, '0');
  return `UP${timePart}${randomPart}`.slice(0, 32);
}

// --- Firestore Client Operations ---

export async function getClientAccountOnce(uid: string): Promise<ClientAccount | null> {
  const docPath = `clients/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'clients', uid));
    if (!snap.exists()) return null;
    return mapClientDoc(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export function subscribeClientAccount(
  uid: string,
  onData: (client: ClientAccount | null) => void,
  onError?: (err: Error) => void
): () => void {
  const docPath = `clients/${uid}`;
  return onSnapshot(
    doc(db, 'clients', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapClientDoc(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, docPath);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeAllClientsForAdmin(
  onData: (clients: ClientAccount[]) => void,
  onError?: (err: Error) => void
): () => void {
  const collectionPath = 'clients';
  const q = query(collection(db, collectionPath), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        mapClientDoc(d.id, d.data() as Record<string, unknown>)
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionPath);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createClientAccount(input: {
  uid: string;
  email: string;
  fullName: string;
  entityName: string;
}): Promise<ClientAccount> {
  const docPath = `clients/${input.uid}`;
  const cleanFullName = input.fullName.trim().slice(0, 120);
  const cleanEntityName = input.entityName.trim().slice(0, 120);
  const cleanEmail = input.email.trim().toLowerCase().slice(0, 254);
  const merchantCode = generateMerchantCode();
  const slug = generateSafeSlug(cleanEntityName, input.uid);

  const payload = {
    id: input.uid,
    uid: input.uid,
    merchantCode,
    slug,
    fullName: cleanFullName,
    entityName: cleanEntityName,
    email: cleanEmail,
    status: 'UNPAID' as const,
    gatewayConfig: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'clients', input.uid), payload);
    const created = await getClientAccountOnce(input.uid);
    if (created) return created;
    const nowIso = new Date().toISOString();
    return {
      id: payload.id,
      uid: payload.uid,
      merchantCode: payload.merchantCode,
      slug: payload.slug,
      fullName: payload.fullName,
      entityName: payload.entityName,
      email: payload.email,
      status: payload.status,
      gatewayConfig: payload.gatewayConfig,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

function sanitizeGatewayConfig(config: GatewayConfig): Record<string, string> {
  const clean: Record<string, string> = {
    upiId: config.upiId.trim().slice(0, 256),
    payeeName: config.payeeName.trim().slice(0, 120),
    accentColor: (config.accentColor || '#0F766E').trim().slice(0, 20),
    configuredAt: new Date().toISOString().slice(0, 64),
  };
  if (config.adminPin?.trim()) {
    clean.adminPin = config.adminPin.trim().slice(0, 64);
  }
  if (config.redirectUrl?.trim()) {
    clean.redirectUrl = config.redirectUrl.trim().slice(0, 500);
  }
  if (config.staticQrDataUrl?.trim()) {
    clean.staticQrDataUrl = config.staticQrDataUrl.trim().slice(0, 500000);
  }
  if (config.deliveryEmail?.trim()) {
    clean.deliveryEmail = config.deliveryEmail.trim().slice(0, 254);
  }
  if (config.deliveryPreference?.trim()) {
    clean.deliveryPreference = config.deliveryPreference.trim().slice(0, 64);
  }
  return clean;
}

export async function updateClientGatewayConfig(
  clientId: string,
  config: GatewayConfig
): Promise<void> {
  const docPath = `clients/${clientId}`;
  const cleanConfig = sanitizeGatewayConfig(config);
  try {
    await updateDoc(doc(db, 'clients', clientId), {
      gatewayConfig: cleanConfig,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function submitActivationUtr(clientId: string, utr: string): Promise<void> {
  const docPath = `clients/${clientId}`;
  const cleanUtr = utr.trim().slice(0, 32);
  try {
    await updateDoc(doc(db, 'clients', clientId), {
      activationUtr: cleanUtr,
      activationSubmittedAt: new Date().toISOString(),
      status: 'PENDING_VERIFICATION',
      rejectedReason: deleteField(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function adminApproveClient(clientId: string): Promise<void> {
  const docPath = `clients/${clientId}`;
  try {
    await updateDoc(doc(db, 'clients', clientId), {
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      rejectedReason: deleteField(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function adminRejectClient(clientId: string, reason?: string): Promise<void> {
  const docPath = `clients/${clientId}`;
  const cleanReason = (
    reason?.trim() || 'UTR could not be verified against FamPay history.'
  ).slice(0, 500);
  try {
    await updateDoc(doc(db, 'clients', clientId), {
      status: 'REJECTED',
      rejectedReason: cleanReason,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

// --- Firestore Orders Operations ---

export function subscribeOrdersForClient(
  clientId: string,
  onData: (orders: CustomerOrder[]) => void,
  onError?: (err: Error) => void
): () => void {
  const collectionPath = 'orders';
  const q = query(
    collection(db, collectionPath),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        mapOrderDoc(d.id, d.data() as Record<string, unknown>)
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionPath);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

// --- Local Cache Helpers for Legacy / Sandbox Utilities ---

export function getClients(): ClientAccount[] {
  try {
    const raw = safeGetLocal(CLIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getClientBySlug(slug: string): ClientAccount | null {
  const normalized = slug.trim().toLowerCase();
  return getClients().find((c) => c.slug.toLowerCase() === normalized) ?? null;
}

export function getOrders(): CustomerOrder[] {
  try {
    const raw = safeGetLocal(ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  safeSetLocal(ORDERS_KEY, JSON.stringify([order, ...orders]));
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
  safeSetLocal(ORDERS_KEY, JSON.stringify(next));
  return updated;
}

// --- Pure Validation & Formatting Utilities ---

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
