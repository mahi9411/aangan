import { Injectable } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { BookingService } from './booking.service'

@Injectable()
export class BookingScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingService,
  ) {}

  @Interval(15000)
  async expire() {
    const rows = await this.prisma.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_lock(842211) AS locked`
    if (!rows[0]?.locked) return
    try {
      await this.bookings.expireDue()
    } finally {
      await this.prisma.$executeRaw`SELECT pg_advisory_unlock(842211)`
    }
  }
}
