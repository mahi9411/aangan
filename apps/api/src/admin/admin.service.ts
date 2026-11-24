import { HttpStatus, Injectable } from '@nestjs/common'
import { fail, pageOf } from '../common/http'
import { splitAmount } from '../domain/money'
import { BookingService } from '../booking/booking.service'
import { PaymentService } from '../payment/payment.service'
import { ProviderService } from '../provider/provider.service'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingService: BookingService,
    private readonly paymentService: PaymentService,
    private readonly providers: ProviderService,
  ) {}

  async overview() {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const [customers, providerCount, pendingKyc, liveJobs, searching, todayPay, recent] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.user.count({ where: { role: 'PROVIDER' } }),
      this.prisma.providerProfile.count({ where: { kycStatus: 'SUBMITTED' } }),
      this.prisma.booking.count({ where: { status: { in: ['ACCEPTED', 'QUOTATION_PENDING', 'QUOTATION_APPROVED', 'EN_ROUTE', 'IN_PROGRESS'] } } }),
      this.prisma.booking.count({ where: { status: 'SEARCHING' } }),
      this.prisma.payment.aggregate({ where: { status: 'CAPTURED', capturedAt: { gte: start } }, _sum: { amountPaise: true, commissionPaise: true }, _count: true }),
      this.prisma.booking.findMany({
        include: { customer: { select: { name: true } }, provider: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ])
    return {
      counts: { customers, providers: providerCount, pendingKyc, liveJobs, searching },
      today: {
        gmvPaise: todayPay._sum.amountPaise ?? 0,
        commissionPaise: todayPay._sum.commissionPaise ?? 0,
        bookingsPaid: todayPay._count,
      },
      recentBookings: recent.map((booking) => ({
        id: booking.id,
        status: booking.status,
        serviceName: booking.serviceName,
        areaLabel: booking.areaLabel,
        pricePaise: booking.pricePaise,
        customerName: booking.customer.name,
        providerName: booking.provider?.name ?? null,
        createdAt: booking.createdAt,
      })),
    }
  }

  async users(role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN' | undefined, q: string | undefined, page?: number) {
    const paging = pageOf(page)
    const where = {
      ...(role ? { role } : {}),
      ...(q ? { OR: [{ phone: { contains: q } }, { name: { contains: q, mode: 'insensitive' as const } }] } : {}),
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: paging.skip, take: paging.take }),
      this.prisma.user.count({ where }),
    ])
    return { items, ...paging, total }
  }

  async setUserActive(actorId: string, userId: string, isActive: boolean) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { isActive } })
    await this.audit(actorId, isActive ? 'user.activate' : 'user.suspend', 'user', userId)
    return user
  }

  async providerList(kyc: string | undefined, q: string | undefined, page?: number) {
    const paging = pageOf(page)
    const where = {
      ...(kyc ? { kycStatus: kyc as 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' } : {}),
      ...(q ? { user: { OR: [{ phone: { contains: q } }, { name: { contains: q, mode: 'insensitive' as const } }] } } : {}),
    }
    const [items, total] = await Promise.all([
      this.prisma.providerProfile.findMany({
        where,
        include: { user: true, skills: { include: { service: true } }, areas: { include: { city: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: paging.skip,
        take: paging.take,
      }),
      this.prisma.providerProfile.count({ where }),
    ])
    return {
      items: items.map((profile) => ({
        id: profile.userId,
        name: profile.user.name,
        phone: profile.user.phone,
        kycStatus: profile.kycStatus,
        isOnline: profile.isOnline,
        ratingAvg: profile.ratingAvg,
        jobsCompleted: profile.jobsCompleted,
        skills: profile.skills.map((skill) => skill.service.name),
        areas: profile.areas.map((area) => `${area.label}, ${area.city.name}`),
      })),
      ...paging,
      total,
    }
  }

  providerDetail(userId: string) {
    return this.prisma.providerProfile.findUnique({
      where: { userId },
      include: { user: true, skills: { include: { service: true } }, areas: true, documents: true, availability: true },
    })
  }

  reviewKyc(actorId: string, userId: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    return this.providers.reviewKyc(actorId, userId, status, reason)
  }

  revealPayout(actorId: string, userId: string) {
    return this.providers.payoutDetails(actorId, userId)
  }

  async bookings(status: string | undefined, page?: number) {
    const paging = pageOf(page)
    const where = status ? { status: status as 'SEARCHING' } : {}
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: { customer: { select: { name: true, phone: true } }, provider: { select: { name: true, phone: true } }, city: true },
        orderBy: { createdAt: 'desc' },
        skip: paging.skip,
        take: paging.take,
      }),
      this.prisma.booking.count({ where }),
    ])
    return { items, ...paging, total }
  }

  booking(id: string, actor: { id: string; role: 'ADMIN'; phone: string; name: string | null }) {
    return this.bookingService.getForUser(id, actor)
  }

  cancel(actor: { id: string; role: 'ADMIN'; phone: string; name: string | null }, id: string, reason: string) {
    return this.bookingService.cancel(id, actor, reason)
  }

  refund(actorId: string, paymentId: string, reason: string) {
    return this.paymentService.refund(paymentId, actorId, reason)
  }

  async payments(status: string | undefined, page?: number) {
    const paging = pageOf(page)
    const where = status ? { status: status as 'CAPTURED' } : {}
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { booking: { select: { serviceName: true, customerId: true, providerId: true } }, refunds: true },
        orderBy: { createdAt: 'desc' },
        skip: paging.skip,
        take: paging.take,
      }),
      this.prisma.payment.count({ where }),
    ])
    return { items, ...paging, total }
  }

  async payouts() {
    const rows = await this.prisma.$queryRaw<Array<{ provider_id: string; balance: bigint | number }>>`
      SELECT provider_id, COALESCE(SUM(amount_paise), 0) AS balance
      FROM ledger_entries
      GROUP BY provider_id
      ORDER BY balance DESC
      LIMIT 100
    `
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.provider_id) } },
      include: { profile: true },
    })
    const payouts = await this.prisma.payout.findMany({ orderBy: { createdAt: 'desc' }, take: 30, include: { provider: true } })
    const byUser = new Map(users.map((user) => [user.id, user]))
    return {
      balances: rows.map((row) => ({
        providerId: row.provider_id,
        name: byUser.get(row.provider_id)?.name ?? null,
        phone: byUser.get(row.provider_id)?.phone ?? null,
        balancePaise: Number(row.balance),
        accountLast4: byUser.get(row.provider_id)?.profile?.accountLast4 ?? null,
        ifsc: byUser.get(row.provider_id)?.profile?.ifsc ?? null,
      })),
      payouts,
    }
  }

  async createPayout(actorId: string, providerId: string, amountPaise: number, note?: string) {
    if (amountPaise < 10000) fail(HttpStatus.BAD_REQUEST, 'PAYOUT_TOO_SMALL', 'Minimum payout is ₹100')
    const balance = await this.prisma.ledgerEntry.aggregate({ where: { providerId }, _sum: { amountPaise: true } })
    const pending = await this.prisma.payout.aggregate({
      where: { providerId, status: 'PENDING' },
      _sum: { amountPaise: true },
    })
    const available = (balance._sum.amountPaise ?? 0) - (pending._sum.amountPaise ?? 0)
    if (amountPaise > available) fail(HttpStatus.CONFLICT, 'INSUFFICIENT_BALANCE', 'Amount is above the available balance')
    const payout = await this.prisma.payout.create({ data: { providerId, amountPaise, note, actorId } })
    await this.audit(actorId, 'payout.create', 'payout', payout.id, { amountPaise })
    return payout
  }

  async markPayoutPaid(actorId: string, payoutId: string, reference: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } })
    if (!payout || payout.status !== 'PENDING') fail(HttpStatus.CONFLICT, 'PAYOUT_CLOSED', 'This payout is not pending')
    await this.prisma.$transaction([
      this.prisma.payout.update({ where: { id: payoutId }, data: { status: 'PAID', reference, paidAt: new Date() } }),
      this.prisma.ledgerEntry.create({
        data: {
          providerId: payout.providerId,
          amountPaise: -payout.amountPaise,
          memo: `Payout ${reference}`,
          dedupeKey: `payout:${payout.id}`,
        },
      }),
    ])
    await this.audit(actorId, 'payout.paid', 'payout', payoutId, { reference })
    return { ok: true }
  }

  async report(from: Date, to: Date) {
    const [payments, refunds, byStatus, daily, newCustomers, newProviders, byService] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'CAPTURED', capturedAt: { gte: from, lte: to } },
        _sum: { amountPaise: true, commissionPaise: true, gstPaise: true, providerPaise: true },
        _count: true,
      }),
      this.prisma.refund.aggregate({
        where: { status: 'PROCESSED', createdAt: { gte: from, lte: to } },
        _sum: { amountPaise: true },
      }),
      this.prisma.booking.groupBy({ by: ['status'], where: { createdAt: { gte: from, lte: to } }, _count: true }),
      this.prisma.$queryRaw<Array<{ day: Date; gmv: number; count: number }>>`
        SELECT date_trunc('day', captured_at) AS day, COALESCE(SUM(amount_paise), 0)::int AS gmv, COUNT(*)::int AS count
        FROM payments
        WHERE status = 'CAPTURED' AND captured_at >= ${from} AND captured_at <= ${to}
        GROUP BY 1 ORDER BY 1
      `,
      this.prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: from, lte: to } } }),
      this.prisma.user.count({ where: { role: 'PROVIDER', createdAt: { gte: from, lte: to } } }),
      this.prisma.$queryRaw<Array<{ service: string; count: number; gmv: number }>>`
        SELECT b.service_name AS service, COUNT(*)::int AS count, COALESCE(SUM(p.amount_paise), 0)::int AS gmv
        FROM payments p
        JOIN bookings b ON b.id = p.booking_id
        WHERE p.status = 'CAPTURED' AND p.captured_at >= ${from} AND p.captured_at <= ${to}
        GROUP BY b.service_name
        ORDER BY gmv DESC
      `,
    ])
    return {
      gmvPaise: payments._sum.amountPaise ?? 0,
      commissionPaise: payments._sum.commissionPaise ?? 0,
      gstPaise: payments._sum.gstPaise ?? 0,
      providerPaise: payments._sum.providerPaise ?? 0,
      capturedCount: payments._count,
      refundPaise: refunds._sum.amountPaise ?? 0,
      bookingsByStatus: byStatus.map((row) => ({ status: row.status, count: row._count })),
      bookingsByService: byService,
      daily: daily.map((row) => ({ date: row.day, gmvPaise: Number(row.gmv), count: Number(row.count) })),
      newCustomers,
      newProviders,
    }
  }

  cities() {
    return this.prisma.city.findMany({ orderBy: { name: 'asc' } })
  }

  createCity(input: { name: string; slug: string; state: string; centerLat: number; centerLng: number; serviceRadiusKm: number }) {
    return this.prisma.city.create({ data: input })
  }

  updateCity(id: string, data: { isActive?: boolean; serviceRadiusKm?: number }) {
    return this.prisma.city.update({ where: { id }, data })
  }

  catalog() {
    return this.prisma.serviceCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { services: { orderBy: { sortOrder: 'asc' }, include: { prices: true } } },
    })
  }

  createCategory(input: { name: string; slug: string; description: string }) {
    return this.prisma.serviceCategory.create({ data: input })
  }

  createService(input: {
    categoryId: string
    name: string
    slug: string
    description: string
    highlights: string[]
    pricingType: 'FIXED' | 'QUOTATION'
    estimatedMinutes: number
  }) {
    return this.prisma.service.create({ data: input })
  }

  async upsertPrice(input: { cityId: string; serviceId: string; pricePaise: number | null; commissionBps: number; isActive: boolean }) {
    splitAmount(input.pricePaise ?? 0, input.commissionBps)
    const service = await this.prisma.service.findUnique({ where: { id: input.serviceId } })
    if (!service) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Service not found')
    if (service.pricingType === 'FIXED' && (input.pricePaise == null || input.pricePaise < 100)) {
      fail(HttpStatus.BAD_REQUEST, 'PRICE_REQUIRED', 'Fixed services need a price of at least ₹1')
    }
    return this.prisma.cityServicePrice.upsert({
      where: { cityId_serviceId: { cityId: input.cityId, serviceId: input.serviceId } },
      update: { pricePaise: input.pricePaise, commissionBps: input.commissionBps, isActive: input.isActive },
      create: input,
    })
  }

  private audit(actorId: string, action: string, entityType: string, entityId: string, metadata?: object) {
    return this.prisma.auditLog.create({ data: { actorId, action, entityType, entityId, metadata } })
  }
}
