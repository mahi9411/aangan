import { Module } from '@nestjs/common'
import { GeoService } from '../geo/geo.service'
import { BookingController } from './booking.controller'
import { BookingScheduler } from './booking.scheduler'
import { BookingService } from './booking.service'

@Module({
  controllers: [BookingController],
  providers: [BookingService, BookingScheduler, GeoService],
  exports: [BookingService],
})
export class BookingModule {}
