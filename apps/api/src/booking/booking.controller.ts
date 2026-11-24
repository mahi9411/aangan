import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { AuthUser, CurrentUser, Roles } from '../common/http'
import { BookingService } from './booking.service'

class CreateBookingDto {
  @IsString() serviceId: string
  @IsString() addressId: string
  @IsIn(['INSTANT', 'SCHEDULED']) mode: 'INSTANT' | 'SCHEDULED'
  @IsOptional() @IsISO8601() scheduledAt?: string
  @IsString() @MinLength(10) @MaxLength(1000) issueDescription: string
  @IsArray() @ArrayMaxSize(4) @IsString({ each: true }) photoUrls: string[]
}

class ReasonDto {
  @IsString() @MinLength(3) @MaxLength(200) reason: string
}

class LineDto {
  @IsString() @MinLength(2) @MaxLength(80) label: string
  @IsInt() @Min(0) amountPaise: number
}

class QuoteDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineDto) lineItems: LineDto[]
  @IsOptional() @IsString() @MaxLength(500) notes?: string
}

class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating: number
  @IsOptional() @IsString() @MaxLength(500) comment?: string
}

@ApiTags('bookings')
@ApiBearerAuth()
@Controller()
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Roles('CUSTOMER')
  @Post('bookings')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateBookingDto, @Headers('idempotency-key') key?: string) {
    return this.bookings.create(user, { ...body, idempotencyKey: key })
  }

  @Roles('CUSTOMER')
  @Get('bookings')
  list(@CurrentUser() user: AuthUser, @Query('page') page?: string, @Query('status') status?: string) {
    return this.bookings.listForCustomer(user, page ? Number(page) : undefined, status)
  }

  @Get('bookings/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookings.getForUser(id, user)
  }

  @Post('bookings/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: ReasonDto) {
    return this.bookings.cancel(id, user, body.reason)
  }

  @Roles('CUSTOMER')
  @Post('bookings/:id/quotes/:quoteId/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('quoteId') quoteId: string) {
    return this.bookings.decideQuote(id, quoteId, user, true)
  }

  @Roles('CUSTOMER')
  @Post('bookings/:id/quotes/:quoteId/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('quoteId') quoteId: string) {
    return this.bookings.decideQuote(id, quoteId, user, false)
  }

  @Roles('CUSTOMER')
  @Post('bookings/:id/review')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: ReviewDto) {
    return this.bookings.review(id, user, body.rating, body.comment)
  }

  @Post('bookings/:id/call')
  call(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookings.call(id, user)
  }

  @Roles('PROVIDER')
  @Get('provider/jobs')
  jobs(@CurrentUser() user: AuthUser) {
    return this.bookings.providerJobs(user.id)
  }

  @Roles('PROVIDER')
  @Post('provider/jobs/:id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookings.accept(id, user)
  }

  @Roles('PROVIDER')
  @Post('provider/jobs/:id/decline')
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookings.decline(id, user.id)
  }

  @Roles('PROVIDER')
  @Post('provider/jobs/:id/release')
  release(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: ReasonDto) {
    return this.bookings.release(id, user, body.reason)
  }

  @Roles('PROVIDER')
  @Post('provider/jobs/:id/advance')
  advance(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookings.advance(id, user)
  }

  @Roles('PROVIDER')
  @Post('provider/jobs/:id/quotation')
  quote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: QuoteDto) {
    return this.bookings.quote(id, user, body)
  }
}
