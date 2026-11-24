export type BookingStatus =
  | 'SEARCHING'
  | 'ACCEPTED'
  | 'QUOTATION_PENDING'
  | 'QUOTATION_APPROVED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED'

export class TransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransitionError'
  }
}

const NEXT: Record<BookingStatus, BookingStatus[]> = {
  SEARCHING: ['ACCEPTED', 'QUOTATION_PENDING', 'CANCELLED', 'EXPIRED'],
  QUOTATION_PENDING: ['QUOTATION_APPROVED', 'CANCELLED'],
  QUOTATION_APPROVED: ['EN_ROUTE', 'CANCELLED', 'SEARCHING'],
  ACCEPTED: ['EN_ROUTE', 'CANCELLED', 'SEARCHING'],
  EN_ROUTE: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['AWAITING_PAYMENT'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['REFUNDED'],
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
}

export const ACTIVE_JOB_STATUSES: BookingStatus[] = [
  'ACCEPTED',
  'QUOTATION_PENDING',
  'QUOTATION_APPROVED',
  'EN_ROUTE',
  'IN_PROGRESS',
]

export const CUSTOMER_CANCELLABLE: BookingStatus[] = [
  'SEARCHING',
  'ACCEPTED',
  'QUOTATION_PENDING',
  'QUOTATION_APPROVED',
  'EN_ROUTE',
]

export const PROVIDER_RELEASABLE: BookingStatus[] = [
  'ACCEPTED',
  'QUOTATION_PENDING',
  'QUOTATION_APPROVED',
]

export function assertTransition(from: BookingStatus, to: BookingStatus) {
  if (!NEXT[from].includes(to)) {
    throw new TransitionError(`Cannot move a booking from ${from} to ${to}`)
  }
}

export function nextProviderStatus(
  current: BookingStatus,
  pricingType: 'FIXED' | 'QUOTATION',
): BookingStatus | null {
  if (current === 'ACCEPTED' && pricingType === 'FIXED') return 'EN_ROUTE'
  if (current === 'QUOTATION_APPROVED') return 'EN_ROUTE'
  if (current === 'EN_ROUTE') return 'IN_PROGRESS'
  if (current === 'IN_PROGRESS') return 'AWAITING_PAYMENT'
  return null
}
