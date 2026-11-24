import { Injectable } from '@nestjs/common'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PushService } from './push.service'
import { RealtimePublisher } from './realtime.publisher'

@Injectable()
export class NotifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimePublisher,
  ) {}

  async user(userId: string, title: string, body: string, data: Record<string, string> = {}) {
    await this.prisma.notification.create({
      data: { userId, title, body, data: data as Prisma.InputJsonValue },
    })
    const devices = await this.prisma.device.findMany({ where: { userId } })
    await this.push.send(
      devices.map((device) => device.token),
      { title, body, data },
    )
    this.realtime.toUser(userId, 'notify', { title, body, data })
    if (data.bookingId) {
      this.realtime.toUser(userId, 'booking:updated', { bookingId: data.bookingId })
      this.realtime.toBooking(data.bookingId, 'booking:updated', { bookingId: data.bookingId })
    }
  }
}
