import { HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthUser, fail, pageOf } from '../common/http'
import {
  assertTransition,
  BookingStatus,
  nextProviderStatus,
  PROVIDER_RELEASABLE,
  TransitionError,
} from '../domain/booking-state'
import { zonedParts } from '../domain/time'
import { PrismaService } from '../prisma/prisma.service'
import { GeoService } from '../geo/geo.service'
import { NotifyService } from '../infra/notify.service'
import { RealtimePublisher } from '../infra/realtime.publisher'
import { bookingGraph, presentBooking, presentCard } from './booking.presenter'

type CreateInput = {
  serviceId: string
  addressId: string
  mode: 'INSTANT' | 'SCHEDULED'
  scheduledAt?: string
  issueDescription: string
  photoUrls: string[]
  idempotencyKey?: string
}

type QuoteInput = { lineItems: Array<{ label: string; amountPaise: number }>; notes?: string }

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    private readonly notify: NotifyService,
    private readonly realtime: RealtimePublisher,
    private readonly config: ConfigService,
  ) {}

  async create(customer: AuthUser, input: CreateInput) {
    if (customer.role !== 'CUSTOMER') fail(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Only customers can book')
    if (input.idempotencyKey) {
      const existing = await this.prisma.booking.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
      if (existing) {
        if (existing.customerId !== customer.id) fail(HttpStatus.CONFLICT, 'IDEMPOTENCY_CONFLICT', 'Retry with a new request')
        return this.getForUser(existing.id, customer)
      }
    }
    const address = await this.prisma.address.findFirst({ where: { id: input.addressId, userId: customer.id } })
    if (!address) fail(HttpStatus.BAD_REQUEST, 'ADDRESS_REQUIRED', 'Choose a saved address')
    const price = await this.prisma.cityServicePrice.findUnique({
      where: { cityId_serviceId: { cityId: address.cityId, serviceId: input.serviceId } },
      include: { service: true, city: true },
    })
    if (!price?.isActive || !price.service.isActive || !price.city.isActive) {
      fail(HttpStatus.BAD_REQUEST, 'SERVICE_UNAVAILABLE', 'This service is not offered there')
    }
    if (price.service.pricingType === 'FIXED' && price.pricePaise == null) {
      fail(HttpStatus.CONFLICT, 'PRICE_UNAVAILABLE', 'This service has no fixed price yet')
    }
    input.photoUrls.forEach((url) => this.assertPhoto(url))
    const scheduledAt = input.mode === 'SCHEDULED' ? this.parseSchedule(input.scheduledAt) : null
    const parts = scheduledAt ? zonedParts(scheduledAt, price.city.timezone) : undefined
    const windowPadMs = 60 * 60 * 1000
    const candidates = await this.geo.listCandidates({
      mode: input.mode,
      serviceId: price.serviceId,
      cityId: address.cityId,
      lat: address.lat,
      lng: address.lng,
      scheduledAt: scheduledAt ?? undefined,
      dayOfWeek: parts?.dayOfWeek,
      minuteOfDay: parts?.minuteOfDay,
      windowStart: scheduledAt ? new Date(scheduledAt.getTime() - windowPadMs) : undefined,
      windowEnd: scheduledAt
        ? new Date(scheduledAt.getTime() + Math.max(price.service.estimatedMinutes, 60) * 60 * 1000)
        : undefined,
    })
    if (!candidates.length) {
      fail(HttpStatus.UNPROCESSABLE_ENTITY, 'NO_PROVIDERS_NEARBY', 'No verified professional is free for this request right now')
    }
    const timeoutSec = Number(
      input.mode === 'INSTANT'
        ? this.config.get<number>('SEARCH_TIMEOUT_INSTANT_SEC')
        : this.config.get<number>('SEARCH_TIMEOUT_SCHEDULED_SEC'),
    )
    const booking = await this.prisma.booking.create({
      data: {
        customerId: customer.id,
        serviceId: price.serviceId,
        cityId: address.cityId,
        addressId: address.id,
        serviceName: price.service.name,
        pricingType: price.service.pricingType,
        mode: input.mode,
        status: 'SEARCHING',
        issueDescription: input.issueDescription.trim(),
        scheduledAt,
        searchExpiresAt: new Date(Date.now() + timeoutSec * 1000),
        addressLine: address.line1,
        landmark: address.landmark,
        areaLabel: address.areaLabel,
        lat: address.lat,
        lng: address.lng,
        pricePaise: price.service.pricingType === 'FIXED' ? price.pricePaise : null,
        commissionBps: price.commissionBps,
        idempotencyKey: input.idempotencyKey,
        photos: { create: input.photoUrls.map((url) => ({ url })) },
        events: { create: { actorId: customer.id, type: 'CREATED', message: `Request sent to ${candidates.length} professionals` } },
        broadcasts: {
          create: candidates.map((candidate) => ({
            providerId: candidate.userId,
            distanceM: Math.round(candidate.distanceM),
          })),
        },
      },
    })
    await Promise.all(
      candidates.map((candidate) => {
        const distanceKm = (candidate.distanceM / 1000).toFixed(1)
        this.realtime.toUser(candidate.userId, 'job:offer', {
          bookingId: booking.id,
          serviceName: booking.serviceName,
          areaLabel: booking.areaLabel,
          distanceM: Math.round(candidate.distanceM),
          mode: booking.mode,
          pricePaise: booking.pricePaise,
          pricingType: booking.pricingType,
          scheduledAt: booking.scheduledAt,
          expiresAt: booking.searchExpiresAt,
        })
        return this.notify.user(
          candidate.userId,
          'New job nearby',
          `${booking.serviceName} · ${distanceKm} km · ${booking.areaLabel}`,
          { bookingId: booking.id },
        )
      }),
    )
    return this.getForUser(booking.id, customer)
  }

  async listForCustomer(user: AuthUser, page?: number, status?: string) {
    const paging = pageOf(page)
    const where = { customerId: user.id, ...(status ? { status: status as BookingStatus } : {}) }
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: { customer: { select: { name: true } }, provider: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: paging.skip,
        take: paging.take,
      }),
      this.prisma.booking.count({ where }),
    ])
    return { items: items.map(presentCard), ...paging, total }
  }

  async providerJobs(providerId: string) {
    const [offers, active, recent] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          status: 'SEARCHING',
          searchExpiresAt: { gt: new Date() },
          broadcasts: { some: { providerId, response: 'PENDING' } },
        },
        include: bookingGraph,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.findMany({
        where: {
          providerId,
          status: { in: ['ACCEPTED', 'QUOTATION_PENDING', 'QUOTATION_APPROVED', 'EN_ROUTE', 'IN_PROGRESS', 'AWAITING_PAYMENT'] },
        },
        include: bookingGraph,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.booking.findMany({
        where: { providerId, status: { in: ['PAID', 'CANCELLED', 'REFUNDED'] } },
        include: { customer: { select: { name: true } }, provider: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ])
    const viewer = { id: providerId, role: 'PROVIDER' as const, phone: '', name: null }
    return {
      offers: offers.map((booking) => presentBooking(booking, viewer)),
      active: active.map((booking) => presentBooking(booking, viewer)),
      recent: recent.map(presentCard),
    }
  }

  async getForUser(id: string, viewer: AuthUser) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: bookingGraph })
    if (!booking) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Booking not found')
    const invited = booking.broadcasts.some((row) => row.providerId === viewer.id)
    const allowed = viewer.role === 'ADMIN' || booking.customerId === viewer.id || booking.providerId === viewer.id || invited
    if (!allowed) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Booking not found')
    return presentBooking(booking, viewer)
  }

  async accept(bookingId: string, provider: AuthUser) {
    const booking = await this.requireBooking(bookingId)
    const invite = booking.broadcasts.find((row) => row.providerId === provider.id)
    if (!invite || invite.response !== 'PENDING') fail(HttpStatus.CONFLICT, 'OFFER_CLOSED', 'This offer is no longer open')
    if (booking.status !== 'SEARCHING') fail(HttpStatus.CONFLICT, 'JOB_TAKEN', 'Another professional already took this job')
    if (booking.searchExpiresAt < new Date()) fail(HttpStatus.CONFLICT, 'OFFER_EXPIRED', 'This request has expired')
    const parts = booking.scheduledAt ? zonedParts(booking.scheduledAt) : undefined
    const eligible = await this.geo.listCandidates({
      mode: booking.mode,
      serviceId: booking.serviceId,
      cityId: booking.cityId,
      lat: booking.lat,
      lng: booking.lng,
      dayOfWeek: parts?.dayOfWeek,
      minuteOfDay: parts?.minuteOfDay,
      windowStart: booking.scheduledAt ? new Date(booking.scheduledAt.getTime() - 60 * 60 * 1000) : undefined,
      windowEnd: booking.scheduledAt ? new Date(booking.scheduledAt.getTime() + 2 * 60 * 60 * 1000) : undefined,
      onlyUserId: provider.id,
    })
    if (!eligible.length) fail(HttpStatus.CONFLICT, 'NOT_ELIGIBLE', 'You are no longer eligible for this job')
    const nextStatus: BookingStatus = booking.pricingType === 'FIXED' ? 'ACCEPTED' : 'QUOTATION_PENDING'
    const losers: string[] = []
    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.booking.updateMany({
          where: { id: bookingId, status: 'SEARCHING' },
          data: { status: nextStatus, providerId: provider.id, acceptedAt: new Date() },
        })
        if (updated.count !== 1) fail(HttpStatus.CONFLICT, 'JOB_TAKEN', 'Another professional already took this job')
        await tx.bookingBroadcast.updateMany({
          where: { bookingId, providerId: provider.id, response: 'PENDING' },
          data: { response: 'ACCEPTED', respondedAt: new Date() },
        })
        const others = await tx.bookingBroadcast.findMany({
          where: { bookingId, providerId: { not: provider.id }, response: 'PENDING' },
        })
        losers.push(...others.map((row) => row.providerId))
        await tx.bookingBroadcast.updateMany({
          where: { bookingId, providerId: { not: provider.id }, response: 'PENDING' },
          data: { response: 'LOST', respondedAt: new Date() },
        })
        await tx.bookingEvent.create({
          data: { bookingId, actorId: provider.id, type: 'ACCEPTED', message: `${provider.name ?? 'A professional'} accepted the job` },
        })
        const conversation = await tx.conversation.upsert({
          where: { bookingId },
          update: {},
          create: { bookingId },
        })
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            kind: 'SYSTEM',
            body: 'You are connected. Use this chat for visit details.',
          },
        })
      })
    } catch (error) {
      if (error instanceof TransitionError) fail(HttpStatus.CONFLICT, 'INVALID_STATE', error.message)
      throw error
    }
    await this.notify.user(booking.customerId, 'Professional assigned', `${provider.name ?? 'A professional'} accepted your ${booking.serviceName} request.`, { bookingId })
    await this.notify.user(provider.id, 'Job confirmed', `${booking.serviceName} in ${booking.areaLabel} is yours.`, { bookingId })
    losers.forEach((userId) => this.realtime.toUser(userId, 'job:closed', { bookingId }))
    return this.getForUser(bookingId, provider)
  }

  async decline(bookingId: string, providerId: string) {
    const updated = await this.prisma.bookingBroadcast.updateMany({
      where: { bookingId, providerId, response: 'PENDING' },
      data: { response: 'DECLINED', respondedAt: new Date() },
    })
    if (updated.count !== 1) fail(HttpStatus.CONFLICT, 'OFFER_CLOSED', 'This offer is no longer open')
    return { ok: true }
  }

  async release(bookingId: string, provider: AuthUser, reason: string) {
    const booking = await this.requireBooking(bookingId)
    if (booking.providerId !== provider.id || !PROVIDER_RELEASABLE.includes(booking.status)) {
      fail(HttpStatus.CONFLICT, 'INVALID_STATE', 'This job can no longer be released')
    }
    await this.prisma.bookingBroadcast.updateMany({
      where: { bookingId, providerId: provider.id },
      data: { response: 'RELEASED', respondedAt: new Date() },
    })
    const parts = booking.scheduledAt ? zonedParts(booking.scheduledAt) : undefined
    const candidates = await this.geo.listCandidates({
      mode: booking.mode,
      serviceId: booking.serviceId,
      cityId: booking.cityId,
      lat: booking.lat,
      lng: booking.lng,
      dayOfWeek: parts?.dayOfWeek,
      minuteOfDay: parts?.minuteOfDay,
      windowStart: booking.scheduledAt ? new Date(booking.scheduledAt.getTime() - 60 * 60 * 1000) : undefined,
      windowEnd: booking.scheduledAt ? new Date(booking.scheduledAt.getTime() + 2 * 60 * 60 * 1000) : undefined,
      excludeBroadcastsForBookingId: bookingId,
    })
    if (!candidates.length) {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'EXPIRED', providerId: null, cancelReason: reason },
      })
      await this.notify.user(booking.customerId, 'Booking needs a retry', 'Your professional had to step back and nobody else is free.', { bookingId })
      return this.getForUser(bookingId, provider)
    }
    const timeoutSec = Number(this.config.get<number>(booking.mode === 'INSTANT' ? 'SEARCH_TIMEOUT_INSTANT_SEC' : 'SEARCH_TIMEOUT_SCHEDULED_SEC'))
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'SEARCHING',
        providerId: null,
        acceptedAt: null,
        searchExpiresAt: new Date(Date.now() + timeoutSec * 1000),
        events: { create: { actorId: provider.id, type: 'RELEASED', message: reason } },
        broadcasts: { create: candidates.map((candidate) => ({ providerId: candidate.userId, distanceM: Math.round(candidate.distanceM) })) },
      },
    })
    await this.notify.user(booking.customerId, 'Finding another professional', 'We are offering your request to someone else nearby.', { bookingId })
    await Promise.all(candidates.map((candidate) => this.notify.user(candidate.userId, 'New job nearby', `${booking.serviceName} · ${booking.areaLabel}`, { bookingId })))
    return this.getForUser(bookingId, provider)
  }

  async advance(bookingId: string, provider: AuthUser) {
    const booking = await this.requireBooking(bookingId)
    if (booking.providerId !== provider.id) fail(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'This is not your job')
    const next = nextProviderStatus(booking.status, booking.pricingType)
    if (!next) fail(HttpStatus.CONFLICT, 'INVALID_STATE', 'There is no next step on this job')
    if (next === 'AWAITING_PAYMENT' && booking.pricePaise == null) {
      fail(HttpStatus.CONFLICT, 'QUOTE_REQUIRED', 'Add an approved quotation before completing the job')
    }
    assertTransition(booking.status, next)
    const labels: Record<string, string> = {
      EN_ROUTE: 'On the way',
      IN_PROGRESS: 'Work started',
      AWAITING_PAYMENT: 'Work finished. Payment is due.',
    }
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: next,
        startedAt: next === 'IN_PROGRESS' ? new Date() : booking.startedAt,
        completedAt: next === 'AWAITING_PAYMENT' ? new Date() : booking.completedAt,
        events: { create: { actorId: provider.id, type: next, message: labels[next] ?? next } },
      },
    })
    if (next === 'EN_ROUTE' || next === 'IN_PROGRESS' || next === 'AWAITING_PAYMENT') {
      await this.system(bookingId, labels[next])
    }
    await this.notify.user(booking.customerId, booking.serviceName, labels[next] ?? 'Booking updated', { bookingId })
    return this.getForUser(bookingId, provider)
  }

  async quote(bookingId: string, provider: AuthUser, input: QuoteInput) {
    const booking = await this.requireBooking(bookingId)
    if (booking.providerId !== provider.id || booking.status !== 'QUOTATION_PENDING') {
      fail(HttpStatus.CONFLICT, 'INVALID_STATE', 'This job is not waiting for a quotation')
    }
    const amountPaise = input.lineItems.reduce((sum, item) => sum + item.amountPaise, 0)
    if (amountPaise < 10000 || amountPaise > 20_000_000) {
      fail(HttpStatus.BAD_REQUEST, 'QUOTE_RANGE', 'Quotations must be between ₹100 and ₹2,00,000')
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.quotation.updateMany({ where: { bookingId, status: 'PENDING' }, data: { status: 'SUPERSEDED' } })
      await tx.quotation.create({
        data: {
          bookingId,
          providerId: provider.id,
          amountPaise,
          notes: input.notes,
          lineItems: input.lineItems,
          validUntil: new Date(Date.now() + 4 * 60 * 60 * 1000),
        },
      })
      await tx.bookingEvent.create({
        data: { bookingId, actorId: provider.id, type: 'QUOTED', message: 'A quotation was sent' },
      })
    })
    await this.system(bookingId, 'A quotation is ready for review.')
    await this.notify.user(booking.customerId, 'Quotation received', `Review the quote for ${booking.serviceName}.`, { bookingId })
    return this.getForUser(bookingId, provider)
  }

  async decideQuote(bookingId: string, quoteId: string, customer: AuthUser, approve: boolean) {
    const booking = await this.requireBooking(bookingId)
    if (booking.customerId !== customer.id) fail(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'This is not your booking')
    const quote = booking.quotes.find((item) => item.id === quoteId)
    if (!quote || quote.status !== 'PENDING') fail(HttpStatus.CONFLICT, 'QUOTE_CLOSED', 'This quotation is no longer open')
    if (quote.validUntil < new Date()) fail(HttpStatus.CONFLICT, 'QUOTE_EXPIRED', 'This quotation has expired')
    if (!approve) {
      await this.prisma.quotation.update({ where: { id: quoteId }, data: { status: 'REJECTED' } })
      await this.notify.user(booking.providerId!, 'Quotation declined', 'Send a revised quote if you still want this job.', { bookingId })
      return this.getForUser(bookingId, customer)
    }
    assertTransition(booking.status, 'QUOTATION_APPROVED')
    await this.prisma.$transaction([
      this.prisma.quotation.update({ where: { id: quoteId }, data: { status: 'APPROVED' } }),
      this.prisma.quotation.updateMany({ where: { bookingId, id: { not: quoteId }, status: 'PENDING' }, data: { status: 'SUPERSEDED' } }),
      this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'QUOTATION_APPROVED',
          pricePaise: quote.amountPaise,
          events: { create: { actorId: customer.id, type: 'QUOTE_APPROVED', message: 'Quotation approved' } },
        },
      }),
    ])
    await this.notify.user(booking.providerId!, 'Quotation approved', 'You can head to the job.', { bookingId })
    return this.getForUser(bookingId, customer)
  }

  async cancel(bookingId: string, actor: AuthUser, reason: string) {
    const booking = await this.requireBooking(bookingId)
    const customerCan = actor.id === booking.customerId && ['SEARCHING', 'ACCEPTED', 'QUOTATION_PENDING', 'QUOTATION_APPROVED', 'EN_ROUTE'].includes(booking.status)
    const adminCan = actor.role === 'ADMIN' && !['PAID', 'REFUNDED', 'CANCELLED', 'EXPIRED'].includes(booking.status)
    if (!customerCan && !adminCan) fail(HttpStatus.CONFLICT, 'INVALID_STATE', 'This booking can no longer be cancelled')
    assertTransition(booking.status, 'CANCELLED')
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelReason: reason,
        cancelledById: actor.id,
        events: { create: { actorId: actor.id, type: 'CANCELLED', message: reason } },
      },
    })
    await this.prisma.bookingBroadcast.updateMany({
      where: { bookingId, response: 'PENDING' },
      data: { response: 'TIMEOUT', respondedAt: new Date() },
    })
    const recipients = [booking.customerId, booking.providerId].filter((id): id is string => Boolean(id) && id !== actor.id)
    await Promise.all(recipients.map((userId) => this.notify.user(userId, 'Booking cancelled', reason, { bookingId })))
    if (booking.status === 'SEARCHING') {
      booking.broadcasts.filter((row) => row.response === 'PENDING').forEach((row) => this.realtime.toUser(row.providerId, 'job:closed', { bookingId }))
    }
    return this.getForUser(bookingId, actor)
  }

  async review(bookingId: string, customer: AuthUser, rating: number, comment?: string) {
    const booking = await this.requireBooking(bookingId)
    if (booking.customerId !== customer.id || booking.status !== 'PAID' || !booking.providerId) {
      fail(HttpStatus.CONFLICT, 'INVALID_STATE', 'You can review a booking after it is paid')
    }
    if (booking.review) fail(HttpStatus.CONFLICT, 'ALREADY_REVIEWED', 'This booking already has a review')
    await this.prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: { bookingId, customerId: customer.id, providerId: booking.providerId!, rating, comment },
      })
      const profile = await tx.providerProfile.findUnique({ where: { userId: booking.providerId! } })
      if (profile) {
        const ratingCount = profile.ratingCount + 1
        const ratingAvg = (profile.ratingAvg * profile.ratingCount + rating) / ratingCount
        await tx.providerProfile.update({ where: { id: profile.id }, data: { ratingCount, ratingAvg } })
      }
    })
    await this.notify.user(booking.providerId, 'New review', `${rating} star review on ${booking.serviceName}`, { bookingId })
    return this.getForUser(bookingId, customer)
  }

  async call(bookingId: string, actor: AuthUser) {
    const booking = await this.requireBooking(bookingId)
    const allowed = actor.id === booking.customerId || actor.id === booking.providerId
    if (!allowed || !['ACCEPTED', 'QUOTATION_PENDING', 'QUOTATION_APPROVED', 'EN_ROUTE', 'IN_PROGRESS', 'AWAITING_PAYMENT'].includes(booking.status)) {
      fail(HttpStatus.CONFLICT, 'INVALID_STATE', 'Calling opens after a professional accepts')
    }
    const phone = actor.id === booking.customerId ? booking.provider?.phone : booking.customer.phone
    if (!phone) fail(HttpStatus.CONFLICT, 'UNAVAILABLE', 'A phone number is not available yet')
    await this.prisma.callLog.create({ data: { bookingId, callerId: actor.id } })
    return { phone }
  }

  async expireDue() {
    const due = await this.prisma.booking.findMany({
      where: { status: 'SEARCHING', searchExpiresAt: { lt: new Date() } },
      take: 40,
    })
    for (const booking of due) {
      const updated = await this.prisma.booking.updateMany({
        where: { id: booking.id, status: 'SEARCHING' },
        data: { status: 'EXPIRED' },
      })
      if (updated.count !== 1) continue
      await this.prisma.bookingBroadcast.updateMany({
        where: { bookingId: booking.id, response: 'PENDING' },
        data: { response: 'TIMEOUT', respondedAt: new Date() },
      })
      await this.prisma.bookingEvent.create({
        data: { bookingId: booking.id, type: 'EXPIRED', message: 'No professional accepted in time' },
      })
      await this.notify.user(booking.customerId, 'No one accepted', 'Try again, or schedule the visit for later.', { bookingId: booking.id })
    }
    const quotes = await this.prisma.quotation.findMany({
      where: { status: 'PENDING', validUntil: { lt: new Date() } },
      take: 40,
    })
    for (const quote of quotes) {
      await this.prisma.quotation.updateMany({ where: { id: quote.id, status: 'PENDING' }, data: { status: 'EXPIRED' } })
    }
  }

  async notifyPaid(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking || booking.status !== 'PAID') return
    const already = await this.prisma.message.findFirst({
      where: { conversation: { bookingId }, kind: 'SYSTEM', body: 'Payment received. Thank you.' },
    })
    if (already) return
    await this.system(bookingId, 'Payment received. Thank you.')
    if (booking.providerId) {
      await this.notify.user(booking.providerId, 'Payment received', `${booking.serviceName} is paid.`, { bookingId })
    }
    await this.notify.user(booking.customerId, 'Payment received', 'You can leave a review whenever you are ready.', { bookingId })
  }

  private async system(bookingId: string, body: string) {
    const conversation = await this.prisma.conversation.upsert({
      where: { bookingId },
      update: {},
      create: { bookingId },
    })
    const message = await this.prisma.message.create({
      data: { conversationId: conversation.id, kind: 'SYSTEM', body },
    })
    this.realtime.toBooking(bookingId, 'chat:message', message)
  }

  private async requireBooking(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: bookingGraph })
    if (!booking) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Booking not found')
    return booking
  }

  private parseSchedule(value?: string) {
    if (!value) fail(HttpStatus.BAD_REQUEST, 'SCHEDULE_REQUIRED', 'Choose a time for the visit')
    const date = new Date(value)
    const min = Date.now() + 2 * 60 * 60 * 1000
    const max = Date.now() + 14 * 24 * 60 * 60 * 1000
    if (Number.isNaN(date.getTime()) || date.getTime() < min || date.getTime() > max) {
      fail(HttpStatus.BAD_REQUEST, 'SCHEDULE_RANGE', 'Schedule a visit between 2 hours and 14 days from now')
    }
    return date
  }

  private assertPhoto(url: string) {
    const base = `${this.config.getOrThrow<string>('PUBLIC_BASE_URL').replace(/\/$/, '')}/uploads/`
    if (!url.startsWith(base) || !/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(url.slice(base.length))) {
      fail(HttpStatus.BAD_REQUEST, 'INVALID_PHOTO', 'Upload photos before attaching them')
    }
  }
}
