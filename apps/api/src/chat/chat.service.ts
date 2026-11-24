import { HttpStatus, Injectable } from '@nestjs/common'
import { AuthUser, fail } from '../common/http'
import { NotifyService } from '../infra/notify.service'
import { RealtimePublisher } from '../infra/realtime.publisher'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisher,
    private readonly notify: NotifyService,
  ) {}

  async list(bookingId: string, viewer: AuthUser) {
    await this.assertMember(bookingId, viewer)
    const conversation = await this.prisma.conversation.findUnique({
      where: { bookingId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
    })
    return (conversation?.messages ?? []).map((message) => ({
      id: message.id,
      senderId: message.senderId,
      kind: message.kind,
      body: message.body,
      createdAt: message.createdAt,
      mine: message.senderId === viewer.id,
    }))
  }

  async send(bookingId: string, viewer: AuthUser, body: string) {
    const booking = await this.assertMember(bookingId, viewer)
    const text = body.trim()
    if (text.length < 1 || text.length > 1000) fail(HttpStatus.BAD_REQUEST, 'INVALID_MESSAGE', 'Write a message under 1000 characters')
    if (['SEARCHING', 'EXPIRED', 'CANCELLED'].includes(booking.status)) {
      fail(HttpStatus.CONFLICT, 'CHAT_CLOSED', 'Chat opens after a professional accepts')
    }
    const conversation = await this.prisma.conversation.upsert({
      where: { bookingId },
      update: {},
      create: { bookingId },
    })
    const message = await this.prisma.message.create({
      data: { conversationId: conversation.id, senderId: viewer.id, kind: 'TEXT', body: text },
    })
    const payload = { id: message.id, senderId: viewer.id, kind: 'TEXT', body: text, createdAt: message.createdAt, bookingId }
    this.realtime.toBooking(bookingId, 'chat:message', payload)
    const recipient = viewer.id === booking.customerId ? booking.providerId : booking.customerId
    if (recipient) {
      await this.notify.user(recipient, viewer.name ?? 'New message', text.slice(0, 140), { bookingId })
    }
    return { ...payload, mine: true }
  }

  async assertMember(bookingId: string, viewer: AuthUser) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Booking not found')
    const allowed = viewer.role === 'ADMIN' || viewer.id === booking.customerId || viewer.id === booking.providerId
    if (!allowed) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Booking not found')
    return booking
  }
}
