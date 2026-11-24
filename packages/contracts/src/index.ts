export type Role = 'CUSTOMER' | 'PROVIDER' | 'ADMIN'
export type BookingMode = 'INSTANT' | 'SCHEDULED'
export type PricingType = 'FIXED' | 'QUOTATION'
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

export function formatInr(paise?: number | null): string {
  if (paise == null) return '—'
  const rupees = paise / 100
  const hasPaise = paise % 100 !== 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees)
}

export function rupeesToPaise(input: string): number {
  const normalized = input.replace(/,/g, '').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Enter an amount with up to 2 decimal places')
  }
  const [rupees, fraction = ''] = normalized.split('.')
  return Number(rupees) * 100 + Number(fraction.padEnd(2, '0'))
}
