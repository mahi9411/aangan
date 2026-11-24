import { Injectable } from '@nestjs/common'
import { Server } from 'socket.io'

@Injectable()
export class RealtimePublisher {
  private server?: Server

  attach(server: Server) {
    this.server = server
  }

  toUser(userId: string, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data)
  }

  toBooking(bookingId: string, event: string, data: unknown) {
    this.server?.to(`booking:${bookingId}`).emit(event, data)
  }
}
