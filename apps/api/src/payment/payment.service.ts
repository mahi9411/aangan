import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { HttpStatus, Injectable } from '@nestjs/common'
import { AuthUser, fail } from '../common/http'
import { splitAmount } from '../domain/money'
import { PrismaService } from '../prisma/prisma.service'
import { RazorpayService } from '../infra/razorpay.service'
import { BookingService } from '../booking/booking.service'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly bookings: BookingService,
    private readonly config: ConfigService,
  ) {}

  async pay(bookingId: string, customer: AuthUser) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { customer: true } })
    if (!booking || booking.customerId !== customer.id) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Booking not found')
    if (booking.status !== 'AWAITING_PAYMENT' || booking.pricePaise == null || booking.commissionBps == null) {
      fail(HttpStatus.CONFLICT, 'NOT_PAYABLE', 'Payment opens after the job is finished')
    }
    const existing = await this.prisma.payment.findFirst({
      where: { bookingId, status: 'CREATED' },
      orderBy: { createdAt: 'desc' },
    })
    if (existing && this.razorpay.mode === 'mock') {
      return { mock: true, bookingId, amountPaise: booking.pricePaise, currency: 'INR' }
    }
    if (existing?.razorpayOrderId && this.razorpay.mode === 'razorpay') {
      const token = randomBytes(24).toString('hex')
      await this.prisma.payment.update({ where: { id: existing.id }, data: { checkoutTokenHash: this.hash(token) } })
      const base = this.config.getOrThrow<string>('PUBLIC_BASE_URL').replace(/\/$/, '')
      return {
        mock: false,
        bookingId,
        amountPaise: booking.pricePaise,
        currency: 'INR',
        keyId: this.razorpay.keyId,
        orderId: existing.razorpayOrderId,
        checkoutUrl: `${base}/v1/payments/checkout/${token}`,
      }
    }
    const split = splitAmount(booking.pricePaise, booking.commissionBps)
    if (this.razorpay.mode === 'mock') {
      await this.prisma.payment.create({
        data: {
          bookingId,
          amountPaise: booking.pricePaise,
          commissionPaise: split.commissionPaise,
          gstPaise: split.gstPaise,
          providerPaise: split.providerPaise,
          razorpayOrderId: `mock_${bookingId}_${Date.now()}`,
        },
      })
      return { mock: true, bookingId, amountPaise: booking.pricePaise, currency: 'INR' }
    }
    if (existing?.razorpayOrderId && existing.checkoutTokenHash) {
      return this.checkoutResponse(booking.pricePaise, existing.id)
    }
    const order = await this.razorpay.createOrder(booking.pricePaise, bookingId, bookingId)
    const token = randomBytes(24).toString('hex')
    const payment = await this.prisma.payment.create({
      data: {
        bookingId,
        amountPaise: booking.pricePaise,
        commissionPaise: split.commissionPaise,
        gstPaise: split.gstPaise,
        providerPaise: split.providerPaise,
        razorpayOrderId: order.id,
        checkoutTokenHash: this.hash(token),
      },
    })
    const base = this.config.getOrThrow<string>('PUBLIC_BASE_URL').replace(/\/$/, '')
    return {
      mock: false,
      bookingId,
      amountPaise: booking.pricePaise,
      currency: 'INR',
      keyId: this.razorpay.keyId,
      orderId: order.id,
      checkoutUrl: `${base}/v1/payments/checkout/${token}`,
      paymentId: payment.id,
    }
  }

  async mockCapture(bookingId: string, customer: AuthUser) {
    if (this.razorpay.mode !== 'mock') fail(HttpStatus.FORBIDDEN, 'MOCK_DISABLED', 'Mock payments are disabled')
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, customerId: customer.id } })
    if (!booking) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Booking not found')
    const payment = await this.prisma.payment.findFirst({
      where: { bookingId, status: 'CREATED' },
      orderBy: { createdAt: 'desc' },
    })
    if (!payment) fail(HttpStatus.CONFLICT, 'NOT_PAYABLE', 'Start payment before confirming it')
    await this.capture(payment.id, `mock_pay_${payment.id}`, 'mock')
    return { ok: true }
  }

  async verify(orderId: string, paymentId: string, signature: string) {
    const secret = this.razorpay.keySecret
    if (!secret) fail(HttpStatus.SERVICE_UNAVAILABLE, 'PAYMENTS_UNAVAILABLE', 'Payments are not configured')
    const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
    const left = Buffer.from(expected)
    const right = Buffer.from(signature)
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      fail(HttpStatus.BAD_REQUEST, 'BAD_SIGNATURE', 'Payment signature did not match')
    }
    const payment = await this.prisma.payment.findUnique({ where: { razorpayOrderId: orderId } })
    if (!payment) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Payment not found')
    await this.capture(payment.id, paymentId, 'razorpay')
    return { ok: true }
  }

  async webhook(rawBody: Buffer, signature: string | undefined) {
    const secret = this.razorpay.webhookSecret
    if (!secret || !signature) fail(HttpStatus.BAD_REQUEST, 'BAD_SIGNATURE', 'Missing webhook signature')
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    const left = Buffer.from(expected)
    const right = Buffer.from(signature)
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      fail(HttpStatus.BAD_REQUEST, 'BAD_SIGNATURE', 'Webhook signature did not match')
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string
      payload?: { payment?: { entity?: { id?: string; order_id?: string; method?: string } } }
    }
    if (event.event !== 'payment.captured') return { ok: true }
    const entity = event.payload?.payment?.entity
    if (!entity?.order_id || !entity.id) return { ok: true }
    const payment = await this.prisma.payment.findUnique({ where: { razorpayOrderId: entity.order_id } })
    if (!payment) return { ok: true }
    await this.capture(payment.id, entity.id, entity.method ?? 'razorpay')
    return { ok: true }
  }

  async checkoutHtml(token: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { checkoutTokenHash: this.hash(token) },
      include: { booking: { include: { customer: true, service: true } } },
    })
    if (!payment || payment.status !== 'CREATED' || !payment.razorpayOrderId) {
      fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'This checkout link is no longer valid')
    }
    const key = this.escape(this.razorpay.keyId ?? '')
    const description = this.escape(payment.booking.serviceName)
    const phone = this.escape(payment.booking.customer.phone)
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pay Aangan</title></head><body>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
var options = {
  key: "${key}",
  amount: ${payment.amountPaise},
  currency: "INR",
  name: "Aangan",
  description: "${description}",
  order_id: "${payment.razorpayOrderId}",
  prefill: { contact: "${phone}" },
  handler: async function (response) {
    await fetch("/v1/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(response) });
    window.location = "aangan-customer://payment-return?bookingId=${payment.bookingId}";
  },
  modal: { ondismiss: function () { window.location = "aangan-customer://payment-return?bookingId=${payment.bookingId}"; } }
};
new Razorpay(options).open();
</script></body></html>`
  }

  async refund(paymentId: string, actorId: string, reason: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: true } })
    if (!payment || payment.status !== 'CAPTURED') fail(HttpStatus.CONFLICT, 'NOT_REFUNDABLE', 'Only a captured payment can be refunded')
    let razorpayRefundId: string | undefined
    if (this.razorpay.mode === 'razorpay') {
      if (!payment.razorpayPaymentId) fail(HttpStatus.CONFLICT, 'NOT_REFUNDABLE', 'The gateway payment id is missing')
      const refund = await this.razorpay.refund(payment.razorpayPaymentId, payment.amountPaise)
      razorpayRefundId = refund.id
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } })
      await tx.refund.create({
        data: { paymentId: payment.id, amountPaise: payment.amountPaise, reason, status: 'PROCESSED', razorpayRefundId, actorId },
      })
      await tx.booking.updateMany({ where: { id: payment.bookingId, status: 'PAID' }, data: { status: 'REFUNDED' } })
      await tx.ledgerEntry.create({
        data: {
          providerId: payment.booking.providerId!,
          bookingId: payment.bookingId,
          amountPaise: -payment.providerPaise,
          memo: `Refund: ${reason}`,
          dedupeKey: `refund:${payment.id}`,
        },
      })
      await tx.bookingEvent.create({
        data: { bookingId: payment.bookingId, actorId, type: 'REFUNDED', message: reason },
      })
    })
    return { ok: true }
  }

  private async capture(paymentId: string, gatewayPaymentId: string, method: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: true } })
    if (!payment) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Payment not found')
    if (payment.status === 'CAPTURED') return
    if (!payment.booking.providerId) fail(HttpStatus.CONFLICT, 'NO_PROVIDER', 'This booking has no professional to pay')
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, status: 'CREATED' },
        data: { status: 'CAPTURED', capturedAt: new Date(), razorpayPaymentId: gatewayPaymentId, method },
      })
      if (updated.count !== 1) return
      const moved = await tx.booking.updateMany({
        where: { id: payment.bookingId, status: 'AWAITING_PAYMENT' },
        data: { status: 'PAID', paidAt: new Date() },
      })
      if (moved.count !== 1) throw new Error('BOOKING_NOT_PAYABLE')
      await tx.ledgerEntry.create({
        data: {
          providerId: payment.booking.providerId!,
          bookingId: payment.bookingId,
          amountPaise: payment.providerPaise,
          memo: `Earning for ${payment.booking.serviceName}`,
          dedupeKey: `earn:${payment.id}`,
        },
      })
      await tx.providerProfile.update({
        where: { userId: payment.booking.providerId! },
        data: { jobsCompleted: { increment: 1 } },
      })
      await tx.bookingEvent.create({
        data: { bookingId: payment.bookingId, type: 'PAID', message: 'Payment received' },
      })
    })
    await this.bookings.notifyPaid(payment.bookingId)
  }

  private checkoutResponse(amountPaise: number, paymentId: string) {
    return { mock: false, amountPaise, currency: 'INR', paymentId, retry: true }
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  private escape(value: string) {
    return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
  }
}
