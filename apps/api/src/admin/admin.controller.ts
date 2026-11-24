import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator'
import { AuthUser, CurrentUser, Roles } from '../common/http'
import { AdminService } from './admin.service'

class ActiveDto {
  @IsBoolean() isActive: boolean
}
class KycDto {
  @IsIn(['APPROVED', 'REJECTED']) status: 'APPROVED' | 'REJECTED'
  @IsOptional() @IsString() reason?: string
}
class CancelDto {
  @IsString() @MinLength(3) reason: string
}
class RefundDto {
  @IsString() @MinLength(3) reason: string
}
class PayoutDto {
  @IsString() providerId: string
  @IsInt() @Min(10000) amountPaise: number
  @IsOptional() @IsString() note?: string
}
class PaidDto {
  @IsString() @MinLength(3) reference: string
}
class CityDto {
  @IsString() name: string
  @IsString() slug: string
  @IsString() state: string
  @Type(() => Number) @IsNumber() centerLat: number
  @Type(() => Number) @IsNumber() centerLng: number
  @Type(() => Number) @IsNumber() serviceRadiusKm: number
}
class CityUpdateDto {
  @IsOptional() @IsBoolean() isActive?: boolean
  @IsOptional() @Type(() => Number) @IsNumber() serviceRadiusKm?: number
}
class CategoryDto {
  @IsString() name: string
  @IsString() slug: string
  @IsString() description: string
}
class ServiceDto {
  @IsString() categoryId: string
  @IsString() name: string
  @IsString() slug: string
  @IsString() description: string
  @IsString({ each: true }) highlights: string[]
  @IsIn(['FIXED', 'QUOTATION']) pricingType: 'FIXED' | 'QUOTATION'
  @IsInt() @Min(15) estimatedMinutes: number
}
class PriceDto {
  @IsString() cityId: string
  @IsString() serviceId: string
  @IsOptional() @IsInt() pricePaise?: number | null
  @IsInt() @Min(0) commissionBps: number
  @IsBoolean() isActive: boolean
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview()
  }

  @Get('users')
  users(@Query('role') role?: 'CUSTOMER' | 'PROVIDER' | 'ADMIN', @Query('q') q?: string, @Query('page') page?: string) {
    return this.admin.users(role, q, page ? Number(page) : undefined)
  }

  @Patch('users/:id')
  active(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: ActiveDto) {
    return this.admin.setUserActive(user.id, id, body.isActive)
  }

  @Get('providers')
  providers(@Query('kyc') kyc?: string, @Query('q') q?: string, @Query('page') page?: string) {
    return this.admin.providerList(kyc, q, page ? Number(page) : undefined)
  }

  @Get('providers/:id')
  provider(@Param('id') id: string) {
    return this.admin.providerDetail(id)
  }

  @Post('providers/:id/kyc')
  kyc(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: KycDto) {
    return this.admin.reviewKyc(user.id, id, body.status, body.reason)
  }

  @Post('providers/:id/payout-account')
  payoutAccount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.revealPayout(user.id, id)
  }

  @Get('bookings')
  bookings(@Query('status') status?: string, @Query('page') page?: string) {
    return this.admin.bookings(status, page ? Number(page) : undefined)
  }

  @Get('bookings/:id')
  booking(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.booking(id, { id: user.id, role: 'ADMIN', phone: user.phone, name: user.name })
  }

  @Post('bookings/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: CancelDto) {
    return this.admin.cancel({ id: user.id, role: 'ADMIN', phone: user.phone, name: user.name }, id, body.reason)
  }

  @Get('payments')
  payments(@Query('status') status?: string, @Query('page') page?: string) {
    return this.admin.payments(status, page ? Number(page) : undefined)
  }

  @Post('payments/:id/refund')
  refund(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: RefundDto) {
    return this.admin.refund(user.id, id, body.reason)
  }

  @Get('payouts')
  payouts() {
    return this.admin.payouts()
  }

  @Post('payouts')
  createPayout(@CurrentUser() user: AuthUser, @Body() body: PayoutDto) {
    return this.admin.createPayout(user.id, body.providerId, body.amountPaise, body.note)
  }

  @Post('payouts/:id/mark-paid')
  markPaid(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: PaidDto) {
    return this.admin.markPayoutPaid(user.id, id, body.reference)
  }

  @Get('reports')
  reports(@Query('from') from?: string, @Query('to') to?: string) {
    const end = to ? new Date(to) : new Date()
    const start = from ? new Date(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
    return this.admin.report(start, end)
  }

  @Get('cities')
  cities() {
    return this.admin.cities()
  }

  @Post('cities')
  createCity(@Body() body: CityDto) {
    return this.admin.createCity(body)
  }

  @Patch('cities/:id')
  updateCity(@Param('id') id: string, @Body() body: CityUpdateDto) {
    return this.admin.updateCity(id, body)
  }

  @Get('catalog')
  catalog() {
    return this.admin.catalog()
  }

  @Post('categories')
  category(@Body() body: CategoryDto) {
    return this.admin.createCategory(body)
  }

  @Post('services')
  service(@Body() body: ServiceDto) {
    return this.admin.createService(body)
  }

  @Post('prices')
  price(@Body() body: PriceDto) {
    return this.admin.upsertPrice({ ...body, pricePaise: body.pricePaise ?? null })
  }
}
