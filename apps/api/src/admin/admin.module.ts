import { Module } from '@nestjs/common'
import { BookingModule } from '../booking/booking.module'
import { PaymentModule } from '../payment/payment.module'
import { ProviderModule } from '../provider/provider.module'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'

@Module({
  imports: [BookingModule, PaymentModule, ProviderModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
