import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Razorpay from 'razorpay'

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name)
  readonly mode: 'mock' | 'razorpay'
  private client?: Razorpay

  constructor(private readonly config: ConfigService) {
    this.mode = config.get<'mock' | 'razorpay'>('PAYMENTS_MODE') ?? 'mock'
    const keyId = config.get<string>('RAZORPAY_KEY_ID')
    const keySecret = config.get<string>('RAZORPAY_KEY_SECRET')
    if (keyId && keySecret) this.client = new Razorpay({ key_id: keyId, key_secret: keySecret })
  }

  get keyId() {
    return this.config.get<string>('RAZORPAY_KEY_ID')
  }

  get webhookSecret() {
    return this.config.get<string>('RAZORPAY_WEBHOOK_SECRET')
  }

  get keySecret() {
    return this.config.get<string>('RAZORPAY_KEY_SECRET')
  }

  async createOrder(amountPaise: number, receipt: string, bookingId: string) {
    if (!this.client) throw new Error('Razorpay is not configured')
    const order = await this.client.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: receipt.slice(0, 40),
      notes: { bookingId },
    })
    return order
  }

  async refund(paymentId: string, amountPaise: number) {
    if (!this.client) throw new Error('Razorpay is not configured')
    return this.client.payments.refund(paymentId, { amount: amountPaise })
  }

  logSkipped(message: string) {
    this.logger.log(message)
  }
}
