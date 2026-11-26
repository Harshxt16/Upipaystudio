import { CheckCircle2, Clock, AlertCircle, CircleSlash } from 'lucide-react';
import { ClientAccountStatus, OrderStatus } from '../types';

interface ClientStatusProps {
  status: ClientAccountStatus;
}

export function ClientStatusLabel({ status }: ClientStatusProps) {
  switch (status) {
    case 'ACTIVE':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Active Gateway
        </span>
      );
    case 'PENDING_VERIFICATION':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Pending Verification
        </span>
      );
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Verification Rejected
        </span>
      );
    case 'UNPAID':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap">
          <CircleSlash className="w-3.5 h-3.5 shrink-0" />
          Unpaid (₹499 Due)
        </span>
      );
  }
}

interface OrderStatusProps {
  status: OrderStatus;
}

export function OrderStatusLabel({ status }: OrderStatusProps) {
  switch (status) {
    case 'APPROVED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Approved
        </span>
      );
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Rejected
        </span>
      );
    case 'PENDING_VERIFICATION':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Pending Verification
        </span>
      );
  }
}
