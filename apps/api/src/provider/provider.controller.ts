import { Body, Controller, Get, Patch, Post, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { AuthUser, CurrentUser, Roles } from '../common/http'
import { ProviderService } from './provider.service'

class DocumentDto {
  @IsIn(['AADHAAR', 'PAN', 'SELFIE']) type: 'AADHAAR' | 'PAN' | 'SELFIE'
  @IsString() fileId: string
}

class OnboardingDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string
  @IsOptional() @IsString() @MaxLength(600) bio?: string
  @IsInt() @Min(0) @Max(50) experienceYears: number
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) serviceIds: string[]
  @IsString() cityId: string
  @IsString() @MaxLength(80) areaLabel: string
  @IsNumber() baseLat: number
  @IsNumber() baseLng: number
  @IsNumber() @Min(2) @Max(40) radiusKm: number
  @IsString() @MinLength(2) accountName: string
  @IsString() accountNumber: string
  @IsString() ifsc: string
  @IsOptional() @IsString() upiId?: string
  @IsArray() @ValidateNested({ each: true }) @Type(() => DocumentDto) documents: DocumentDto[]
}

class DayDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek: number
  @IsInt() @Min(0) startMin: number
  @IsInt() @Min(0) endMin: number
  @IsBoolean() isActive: boolean
}

class AvailabilityDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => DayDto) days: DayDto[]
}

class PresenceDto {
  @IsBoolean() isOnline: boolean
  @IsOptional() @IsNumber() lat?: number
  @IsOptional() @IsNumber() lng?: number
}

@ApiTags('provider')
@ApiBearerAuth()
@Roles('PROVIDER')
@Controller('provider')
export class ProviderController {
  constructor(private readonly providers: ProviderService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.providers.me(user.id)
  }

  @Post('onboarding')
  onboard(@CurrentUser() user: AuthUser, @Body() body: OnboardingDto) {
    return this.providers.onboard(user, body)
  }

  @Put('availability')
  availability(@CurrentUser() user: AuthUser, @Body() body: AvailabilityDto) {
    return this.providers.availability(user.id, body.days)
  }

  @Patch('presence')
  presence(@CurrentUser() user: AuthUser, @Body() body: PresenceDto) {
    return this.providers.presence(user.id, body.isOnline, body.lat, body.lng)
  }

  @Get('earnings')
  earnings(@CurrentUser() user: AuthUser) {
    return this.providers.earnings(user.id)
  }
}
