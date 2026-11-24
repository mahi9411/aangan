import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { Server, Socket } from 'socket.io'
import { ChatService } from '../chat/chat.service'
import { PrismaService } from '../prisma/prisma.service'
import { RealtimePublisher } from './realtime.publisher'

@WebSocketGateway({ cors: { origin: true, credentials: true }, path: '/realtime' })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name)

  @WebSocketServer()
  server: Server

  constructor(
    private readonly publisher: RealtimePublisher,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.publisher.attach(server)
    const url = this.config.get<string>('REDIS_URL')
    if (!url) return
    const pub = new Redis(url, { maxRetriesPerRequest: 2 })
    const sub = pub.duplicate()
    server.adapter(createAdapter(pub, sub))
    this.logger.log('Socket.IO Redis adapter enabled')
  }

  async handleConnection(socket: Socket) {
    try {
      const token = String(socket.handshake.auth?.token ?? '')
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token)
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user?.isActive) throw new Error('inactive')
      socket.data.userId = user.id
      socket.data.role = user.role
      socket.data.name = user.name
      await socket.join(`user:${user.id}`)
    } catch {
      socket.disconnect(true)
    }
  }

  @SubscribeMessage('booking:join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: { bookingId?: string }) {
    if (!body?.bookingId || !socket.data.userId) return { ok: false }
    try {
      await this.chat.assertMember(body.bookingId, {
        id: socket.data.userId,
        role: socket.data.role,
        phone: '',
        name: socket.data.name,
      })
      await socket.join(`booking:${body.bookingId}`)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  @SubscribeMessage('chat:send')
  send(@ConnectedSocket() socket: Socket, @MessageBody() body: { bookingId?: string; body?: string }) {
    if (!body?.bookingId || !body.body || !socket.data.userId) return { ok: false }
    return this.chat.send(
      body.bookingId,
      { id: socket.data.userId, role: socket.data.role, phone: '', name: socket.data.name },
      body.body,
    )
  }
}
