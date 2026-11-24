import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator'
import { AuthUser, CurrentUser, Public } from '../common/http'
import { AuthService } from './auth.service'

class OtpRequestDto {
  @IsString() phone: string
  @IsIn(['CUSTOMER', 'PROVIDER', 'ADMIN']) role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN'
}

class OtpVerifyDto extends OtpRequestDto {
  @IsString() @Length(6, 6) code: string
  @IsOptional() @IsString() @MaxLength(80) name?: string
}

class RefreshDto {
  @IsString() refreshToken: string
}

class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string
  @IsOptional() @IsEmail() email?: string
}

class DeviceDto {
  @IsString() token: string
  @IsString() @MaxLength(20) platform: string
}

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('auth/otp/request')
  request(@Body() body: OtpRequestDto) {
    return this.auth.requestOtp(body.phone, body.role)
  }

  @Public()
  @Post('auth/otp/verify')
  verify(@Body() body: OtpVerifyDto) {
    return this.auth.verifyOtp(body.phone, body.role, body.code, body.name)
  }

  @Public()
  @Post('auth/refresh')
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken)
  }

  @Post('auth/logout')
  logout(@Body() body: RefreshDto) {
    return this.auth.logout(body.refreshToken)
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() body: UpdateMeDto) {
    return this.auth.updateMe(user.id, body)
  }

  @Post('devices')
  saveDevice(@CurrentUser() user: AuthUser, @Body() body: DeviceDto) {
    return this.auth.saveDevice(user.id, body.token, body.platform)
  }

  @Delete('devices')
  removeDevice(@CurrentUser() user: AuthUser, @Body() body: DeviceDto) {
    return this.auth.removeDevice(user.id, body.token)
  }

  @Get('notifications')
  notifications(@CurrentUser() user: AuthUser) {
    return this.auth.notifications(user.id)
  }

  @Post('notifications/:id/read')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.auth.markNotificationRead(user.id, id)
  }
}
