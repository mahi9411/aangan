import { AuthUser } from '../common/http'
import { CUSTOMER_CANCELLABLE, nextProviderStatus, PROVIDER_RELEASABLE } from '../domain/booking-state'
import { Prisma } from '../generated/prisma/client'

export const bookingGraph = {
  photos: { orderBy: { createdAt: 'asc' as const } },
  events: { orderBy: { createdAt: 'asc' as const } },
  quotes: { orderBy: { createdAt: 'desc' as const } },
  customer: { select: { id: true, name: true, phone: true } },
  provider: {
    select: {
      id: true,
      name: true,
      phone: true,
      profile: { select: { ratingAvg: true, ratingCount: true, jobsCompleted: true } },
    },
  },
  review: true,
  payments: { orderBy: { createdAt: 'desc' as const } },
  broadcasts: true,
} satisfies Prisma.BookingInclude

export type BookingGraph = Prisma.BookingGetPayload<{ include: typeof bookingGraph }>

const OPEN_FOR_CONTACT = ['ACCEPTED', 'QUOTATION_PENDING', 'QUOTATION_APPROVED', 'EN_ROUTE', 'IN_PROGRESS', 'AWAITING_PAYMENT']

export function presentBooking(booking: BookingGraph, viewer: AuthUser) {
  const isCustomer = viewer.id === booking.customerId
  const isAssigned = viewer.id === booking.providerId
  const isAdmin = viewer.role === 'ADMIN'
  const invite = booking.broadcasts.find((row) => row.providerId === viewer.id)
  const showExact = isAdmin || isCustomer || isAssigned
  const pendingQuote = booking.quotes.find((quote) => quote.status === 'PENDING' && quote.validUntil > new Date())
  const quote = pendingQuote ?? booking.quotes.find((item) => item.status === 'APPROVED') ?? booking.quotes[0] ?? null
  const latestPayment = booking.payments[0] ?? null

  return {
    id: booking.id,
    status: booking.status,
    mode: booking.mode,
    pricingType: booking.pricingType,
    serviceId: booking.serviceId,
    serviceName: booking.serviceName,
    issueDescription: booking.issueDescription,
    scheduledAt: booking.scheduledAt,
    searchExpiresAt: booking.searchExpiresAt,
    pricePaise: booking.pricePaise,
    areaLabel: booking.areaLabel,
    distanceM: invite?.distanceM ?? null,
    address: showExact
      ? {
          line: booking.addressLine,
          landmark: booking.landmark,
          area: booking.areaLabel,
          lat: booking.lat,
          lng: booking.lng,
          mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${booking.lat},${booking.lng}`,
        }
      : { line: null, landmark: null, area: booking.areaLabel, lat: null, lng: null, mapsUrl: null },
    photos: booking.photos.map((photo) => ({ id: photo.id, url: photo.url })),
    customer: {
      id: booking.customer.id,
      name: booking.customer.name,
      phone: isAdmin || isAssigned ? booking.customer.phone : null,
    },
    provider: booking.provider
      ? {
          id: booking.provider.id,
          name: booking.provider.name,
          phone: isAdmin || isCustomer ? booking.provider.phone : null,
          ratingAvg: booking.provider.profile?.ratingAvg ?? 0,
          ratingCount: booking.provider.profile?.ratingCount ?? 0,
          jobsCompleted: booking.provider.profile?.jobsCompleted ?? 0,
        }
      : null,
    quote: quote
      ? {
          id: quote.id,
          amountPaise: quote.amountPaise,
          notes: quote.notes,
          lineItems: quote.lineItems,
          status: quote.status,
          validUntil: quote.validUntil,
        }
      : null,
    payment: latestPayment ? { id: latestPayment.id, status: latestPayment.status, amountPaise: latestPayment.amountPaise } : null,
    review: booking.review ? { rating: booking.review.rating, comment: booking.review.comment } : null,
    notifiedCount: booking.broadcasts.length,
    events: booking.events.map((event) => ({ id: event.id, type: event.type, message: event.message, createdAt: event.createdAt })),
    createdAt: booking.createdAt,
    permissions: {
      canCancel:
        (isCustomer && CUSTOMER_CANCELLABLE.includes(booking.status)) ||
        (isAdmin && !['PAID', 'REFUNDED', 'CANCELLED', 'EXPIRED'].includes(booking.status)),
      canPay: isCustomer && booking.status === 'AWAITING_PAYMENT' && booking.pricePaise != null,
      canReview: isCustomer && booking.status === 'PAID' && !booking.review,
      canChat: (isCustomer || isAssigned || isAdmin) && !['SEARCHING', 'EXPIRED', 'CANCELLED'].includes(booking.status),
      canCall: (isCustomer || isAssigned) && OPEN_FOR_CONTACT.includes(booking.status),
      canAccept: viewer.role === 'PROVIDER' && booking.status === 'SEARCHING' && invite?.response === 'PENDING' && booking.searchExpiresAt > new Date(),
      canDecline: viewer.role === 'PROVIDER' && booking.status === 'SEARCHING' && invite?.response === 'PENDING',
      canAdvance: isAssigned && nextProviderStatus(booking.status, booking.pricingType) != null,
      canQuote: isAssigned && booking.pricingType === 'QUOTATION' && booking.status === 'QUOTATION_PENDING',
      canRelease: isAssigned && PROVIDER_RELEASABLE.includes(booking.status),
      canApproveQuote: isCustomer && Boolean(pendingQuote),
    },
  }
}

export function presentCard(booking: {
  id: string
  status: string
  mode: string
  serviceName: string
  pricePaise: number | null
  pricingType: string
  scheduledAt: Date | null
  areaLabel: string
  createdAt: Date
  customer?: { name: string | null } | null
  provider?: { name: string | null } | null
}) {
  return {
    id: booking.id,
    status: booking.status,
    mode: booking.mode,
    serviceName: booking.serviceName,
    pricePaise: booking.pricePaise,
    pricingType: booking.pricingType,
    scheduledAt: booking.scheduledAt,
    areaLabel: booking.areaLabel,
    createdAt: booking.createdAt,
    customerName: booking.customer?.name ?? null,
    providerName: booking.provider?.name ?? null,
  }
}
