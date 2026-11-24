import { Global, Module } from '@nestjs/common'
import { NotifyService } from './notify.service'
import { PushService } from './push.service'
import { RazorpayService } from './razorpay.service'
import { RealtimePublisher } from './realtime.publisher'
import { SmsService } from './sms.service'

@Global()
@Module({
  providers: [SmsService, PushService, RazorpayService, RealtimePublisher, NotifyService],
  exports: [SmsService, PushService, RazorpayService, RealtimePublisher, NotifyService],
})
export class InfraModule {}
