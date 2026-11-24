import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { AuthUser, CurrentUser, Public, Roles } from '../common/http'
import { CatalogService } from './catalog.service'

class AddressDto {
  @IsString() @MaxLength(40) label: string
  @IsString() @MinLength(3) @MaxLength(160) line1: string
  @IsOptional() @IsString() @MaxLength(120) landmark?: string
  @IsString() @MaxLength(80) areaLabel: string
  @Type(() => Number) @IsLatitude() lat: number
  @Type(() => Number) @IsLongitude() lng: number
  @IsString() cityId: string
}

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get('cities')
  cities() {
    return this.catalog.listCities()
  }

  @Public()
  @Get('geo/resolve')
  resolve(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.catalog.resolve(Number(lat), Number(lng))
  }

  @Public()
  @Get('catalog/categories')
  categories(@Query('cityId') cityId: string) {
    return this.catalog.categories(cityId)
  }

  @Public()
  @Get('catalog/services')
  services(@Query('cityId') cityId: string, @Query('categoryId') categoryId?: string) {
    return this.catalog.services(cityId, categoryId)
  }

  @Public()
  @Get('catalog/services/:id')
  service(@Param('id') id: string, @Query('cityId') cityId: string) {
    return this.catalog.service(id, cityId)
  }

  @Roles('CUSTOMER')
  @Get('addresses')
  addresses(@CurrentUser() user: AuthUser) {
    return this.catalog.listAddresses(user.id)
  }

  @Roles('CUSTOMER')
  @Post('addresses')
  createAddress(@CurrentUser() user: AuthUser, @Body() body: AddressDto) {
    return this.catalog.createAddress(user.id, body)
  }

  @Roles('CUSTOMER')
  @Delete('addresses/:id')
  removeAddress(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.catalog.removeAddress(user.id, id)
  }
}
