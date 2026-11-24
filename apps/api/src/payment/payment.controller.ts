import { Body, Controller, Get, Header, Headers, Param, Post, Req, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { IsString } from 'class-validator'
import { Request, Response } from 'express'
import { AuthUser, CurrentUser, Public, Roles } from '../common/http'
import { PaymentService } from './payment.service'

class MockDto {
  @IsString() bookingId: string
}

class VerifyDto {
  @IsString() razorpay_order_id: string
  @IsString() razorpay_payment_id: string
  @IsString() razorpay_signature: string
}

@ApiTags('payments')
@Controller()
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Roles('CUSTOMER')
  @Post('bookings/:id/pay')
  pay(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.pay(id, user)
  }

  @Roles('CUSTOMER')
  @Post('payments/mock-capture')
  mock(@CurrentUser() user: AuthUser, @Body() body: MockDto) {
    return this.payments.mockCapture(body.bookingId, user)
  }

  @Public()
  @Post('payments/verify')
  verify(@Body() body: VerifyDto) {
    return this.payments.verify(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)
  }

  @Public()
  @Post('payments/webhook/razorpay')
  webhook(@Req() request: Request & { rawBody?: Buffer }, @Headers('x-razorpay-signature') signature?: string) {
    return this.payments.webhook(request.rawBody ?? Buffer.from(''), signature)
  }

  @Public()
  @Get('payments/checkout/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async checkout(@Param('token') token: string, @Res() response: Response) {
    response.type('html').send(await this.payments.checkoutHtml(token))
  }
}
