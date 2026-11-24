import { HttpStatus, Injectable } from '@nestjs/common'
import { fail } from '../common/http'
import { haversineKm } from '../domain/geo'
import { PrismaService } from '../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  listCities() {
    return this.prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, state: true, timezone: true },
    })
  }

  async resolve(lat: number, lng: number) {
    const cities = await this.prisma.city.findMany({ where: { isActive: true } })
    let best: { id: string; name: string; slug: string; state: string; distanceKm: number } | null = null
    for (const city of cities) {
      const distanceKm = haversineKm(lat, lng, city.centerLat, city.centerLng)
      if (distanceKm <= city.serviceRadiusKm && (!best || distanceKm < best.distanceKm)) {
        best = { id: city.id, name: city.name, slug: city.slug, state: city.state, distanceKm }
      }
    }
    let areaLabel: string | null = null
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY')
    if (key && best) {
      try {
        const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
        url.searchParams.set('latlng', `${lat},${lng}`)
        url.searchParams.set('key', key)
        const data = (await fetch(url).then((response) => response.json())) as {
          results?: Array<{ address_components?: Array<{ long_name: string; types: string[] }> }>
        }
        const components = data.results?.[0]?.address_components ?? []
        areaLabel =
          components.find((component) =>
            component.types.some((type) => type === 'sublocality' || type === 'neighborhood' || type === 'sublocality_level_1'),
          )?.long_name ?? null
      } catch {
        areaLabel = null
      }
    }
    return {
      serviceable: Boolean(best),
      distanceKm: best ? Math.round(best.distanceKm * 10) / 10 : null,
      areaLabel,
      city: best ? { id: best.id, name: best.name, slug: best.slug, state: best.state } : null,
    }
  }

  async categories(cityId: string) {
    await this.assertCity(cityId)
    const prices = await this.prisma.cityServicePrice.findMany({
      where: { cityId, isActive: true, service: { isActive: true, category: { isActive: true } } },
      include: { service: { include: { category: true } } },
    })
    const grouped = new Map<string, { id: string; name: string; slug: string; description: string; serviceCount: number }>()
    for (const price of prices) {
      const category = price.service.category
      const current = grouped.get(category.id) ?? {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        serviceCount: 0,
      }
      current.serviceCount += 1
      grouped.set(category.id, current)
    }
    return [...grouped.values()]
  }

  async services(cityId: string, categoryId?: string) {
    await this.assertCity(cityId)
    const prices = await this.prisma.cityServicePrice.findMany({
      where: {
        cityId,
        isActive: true,
        service: { isActive: true, ...(categoryId ? { categoryId } : {}), category: { isActive: true } },
      },
      include: { service: { include: { category: true } } },
      orderBy: { service: { sortOrder: 'asc' } },
    })
    return prices.map((price) => this.presentService(price.service, price.pricePaise, price.commissionBps))
  }

  async service(id: string, cityId: string) {
    const price = await this.prisma.cityServicePrice.findUnique({
      where: { cityId_serviceId: { cityId, serviceId: id } },
      include: { service: { include: { category: true } } },
    })
    if (!price || !price.isActive || !price.service.isActive) {
      fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'This service is not offered in the selected city')
    }
    const pros = await this.prisma.providerSkill.findMany({
      where: {
        serviceId: id,
        profile: { kycStatus: 'APPROVED', user: { isActive: true }, areas: { some: { cityId } } },
      },
      include: { profile: { include: { user: true, areas: { where: { cityId } } } } },
      take: 12,
    })
    return {
      ...this.presentService(price.service, price.pricePaise, price.commissionBps),
      pros: pros.map((skill) => ({
        id: skill.profile.userId,
        name: skill.profile.user.name,
        ratingAvg: skill.profile.ratingAvg,
        ratingCount: skill.profile.ratingCount,
        jobsCompleted: skill.profile.jobsCompleted,
        experienceYears: skill.profile.experienceYears,
        areas: skill.profile.areas.map((area) => area.label),
      })),
    }
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
  }

  async createAddress(
    userId: string,
    input: { label: string; line1: string; landmark?: string; areaLabel: string; lat: number; lng: number; cityId: string },
  ) {
    await this.assertCity(input.cityId)
    if (input.lat < 6 || input.lat > 38 || input.lng < 68 || input.lng > 98) {
      fail(HttpStatus.BAD_REQUEST, 'OUTSIDE_INDIA', 'Pin a location inside India')
    }
    const resolved = await this.resolve(input.lat, input.lng)
    if (!resolved.city || resolved.city.id !== input.cityId) {
      fail(HttpStatus.BAD_REQUEST, 'CITY_MISMATCH', 'That pin is outside the selected city')
    }
    const count = await this.prisma.address.count({ where: { userId } })
    return this.prisma.address.create({
      data: { ...input, userId, isDefault: count === 0 },
    })
  }

  async removeAddress(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({ where: { id, userId } })
    if (!address) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Address not found')
    await this.prisma.address.delete({ where: { id } })
    return { ok: true }
  }

  private presentService(
    service: {
      id: string
      name: string
      slug: string
      description: string
      highlights: string[]
      pricingType: 'FIXED' | 'QUOTATION'
      estimatedMinutes: number
      category: { id: string; name: string; slug: string }
    },
    pricePaise: number | null,
    commissionBps: number,
  ) {
    return {
      id: service.id,
      name: service.name,
      slug: service.slug,
      description: service.description,
      highlights: service.highlights,
      pricingType: service.pricingType,
      estimatedMinutes: service.estimatedMinutes,
      pricePaise: service.pricingType === 'FIXED' ? pricePaise : null,
      priceLabel: service.pricingType === 'FIXED' ? null : 'Quote after visit',
      category: service.category,
      commissionBps,
    }
  }

  private async assertCity(cityId: string) {
    const city = await this.prisma.city.findFirst({ where: { id: cityId, isActive: true } })
    if (!city) fail(HttpStatus.BAD_REQUEST, 'CITY_UNAVAILABLE', 'Choose a city Aangan is live in')
    return city
  }
}
