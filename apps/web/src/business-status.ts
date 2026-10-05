export type BusinessTone = 'neutral' | 'pending' | 'active' | 'success' | 'attention' | 'invited';
const tones: Record<string, BusinessTone> = {
  DRAFT: 'neutral', UNMATCHED: 'neutral', CANCELLED: 'neutral', CLOSED: 'neutral', WITHDRAWN: 'neutral', VOID: 'neutral', ARCHIVED: 'neutral',
  PENDING: 'pending', WAITING: 'pending', REVIEW: 'pending', SIGNING: 'pending', OPEN: 'pending', SENT: 'pending', PENDING_CONFIRM: 'pending', PENDING_CONFIRMATION: 'pending', REMATCH: 'pending', DISPATCHED: 'pending', ACCEPTED: 'pending',
  ACTIVE: 'active', PUBLISHED: 'active', IN_PROGRESS: 'active', SUBMITTED: 'active', BIDDING: 'active', NEGOTIATING: 'active', PARTIAL: 'active', CHECKING: 'active', RECHECK: 'pending', IN_TRANSIT: 'active', LOADED: 'active', AT_LOADING: 'active', ARRIVED: 'active', UNLOADED: 'active', RECEIVED: 'active',
  COMPLETED: 'success', MATCHED: 'success', CONFIRMED: 'success', EFFECTIVE: 'success', SETTLED: 'success', RESOLVED: 'success',
  REJECTED: 'attention', EXCEPTION: 'attention', DISPUTED: 'attention', RETURNED: 'attention', EXPIRED: 'attention', PAUSED: 'attention', TERMINATED: 'attention', INITIALIZATION: 'pending',
  DIRECTED: 'invited',
};
export function businessTone(status?: string): BusinessTone { return tones[status || ''] || 'neutral'; }
export function businessRowClass({ row }: { row: any }) { return 'business-row-' + businessTone(row.status); }
