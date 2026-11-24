import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { validateEnv } from './config'
import { AdminModule } from './admin/admin.module'
import { AuthModule } from './auth/auth.module'
import { BookingModule } from './booking/booking.module'
import { CatalogModule } from './catalog/catalog.module'
import { ChatModule } from './chat/chat.module'
import { HealthController } from './health.controller'
import { InfraModule } from './infra/infra.module'
import { RealtimeModule } from './infra/realtime.module'
import { PaymentModule } from './payment/payment.module'
import { PrismaModule } from './prisma/prisma.module'
import { ProviderModule } from './provider/provider.module'
import { SecurityModule } from './security/security.module'
import { UploadModule } from './upload/upload.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    PrismaModule,
    SecurityModule,
    InfraModule,
    AuthModule,
    CatalogModule,
    BookingModule,
    ProviderModule,
    PaymentModule,
    ChatModule,
    RealtimeModule,
    AdminModule,
    UploadModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
