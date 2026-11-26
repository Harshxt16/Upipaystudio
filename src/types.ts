export type ClientAccountStatus =
  | 'UNPAID'
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'REJECTED';

export type OrderStatus = 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED';

export interface GatewayConfig {
  upiId: string;
  payeeName: string;
  adminPin?: string;
  deliveryEmail?: string;
  deliveryPreference?: string;
  staticQrDataUrl?: string;
  accentColor: string;
  redirectUrl?: string;
  configuredAt?: string;
}

export interface ClientAccount {
  id: string;
  uid?: string;
  merchantCode?: string;
  slug: string;
  fullName: string;
  entityName: string;
  email: string;
  password?: string;
  status: ClientAccountStatus;
  gatewayConfig: GatewayConfig | null;
  activationUtr?: string;
  activationSubmittedAt?: string;
  activatedAt?: string;
  rejectedReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerOrder {
  id: string;
  clientId: string;
  clientSlug: string;
  orderId: string;
  amount: number;
  utr: string;
  customerName?: string;
  customerNote?: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UsedUtrRecord {
  utr: string;
  clientId: string;
  amount: number;
  activatedAt: string;
  createdAt: string;
}

export interface FamPayAlertRecord {
  utr: string;
  amount: number;
  sender_email: string;
  raw_subject: string;
  received_at: string;
  matched: boolean;
  matchedClientId?: string;
  matchedAt?: string;
  createdAt: string;
}

export interface FamPaySyncConfig {
  id: string;
  notificationEmail: string;
  vercelAppUrl: string;
  updatedAt: string;
}

export interface ActivationSubmitResult {
  status: 'ACTIVE' | 'PENDING_VERIFICATION';
  autoConfirmed: boolean;
  utr: string;
}

export type AppView =
  | { type: 'landing' }
  | { type: 'dashboard' }
  | { type: 'admin' }
  | { type: 'gateway'; slug: string; amount?: number; orderId?: string; embed?: boolean };
