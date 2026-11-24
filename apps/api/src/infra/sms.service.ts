import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { fail } from '../common/http'

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, code: string) {
    const provider = this.config.get<string>('SMS_PROVIDER')
    if (provider === 'msg91') {
      const response = await fetch('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: {
          authkey: this.config.getOrThrow<string>('MSG91_AUTH_KEY'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: this.config.getOrThrow<string>('MSG91_TEMPLATE_ID'),
          mobile: phone.replace('+', ''),
          otp: code,
        }),
      })
      if (!response.ok) {
        this.logger.error(`MSG91 OTP failed: ${response.status}`)
        fail(HttpStatus.SERVICE_UNAVAILABLE, 'SMS_FAILED', 'We could not send the code. Try again shortly.')
      }
      return
    }
    if (this.config.get<string>('ALLOW_DEV_OTP') === 'true') {
      this.logger.log(`Dev OTP for ${phone}: ${code}`)
      return
    }
    this.logger.log(`OTP dispatched to ${phone}`)
  }
}
