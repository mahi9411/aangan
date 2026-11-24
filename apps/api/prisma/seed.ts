import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { encryptField } from '../src/domain/crypto'
import { splitAmount } from '../src/domain/money'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const catalog = [
  {
    slug: 'electrician',
    name: 'Electrician',
    description: 'Fans, boards, wiring, and power backup.',
    services: [
      ['ceiling-fan-installation', 'Ceiling fan installation', 'FIXED', 39900, 60, 'A new fan fitted, balanced, and tested.'],
      ['switch-socket-repair', 'Switch and socket repair', 'FIXED', 24900, 45, 'Burnt switches, loose sockets, and sparking points.'],
      ['mcb-replacement', 'MCB replacement', 'FIXED', 29900, 45, 'Tripping breakers replaced with the right rating.'],
      ['wiring-inspection', 'Full house wiring inspection', 'QUOTATION', null, 90, 'A written inspection before any rewiring.'],
    ],
  },
  {
    slug: 'plumber',
    name: 'Plumber',
    description: 'Taps, leaks, flushes, and blocked drains.',
    services: [
      ['tap-mixer-repair', 'Tap and mixer repair', 'FIXED', 24900, 45, 'Dripping taps and stiff mixers.'],
      ['flush-repair', 'Cistern and flush repair', 'FIXED', 34900, 60, 'Running flushes and weak cisterns.'],
      ['drain-blockage', 'Drain blockage', 'FIXED', 49900, 60, 'Kitchen and bathroom drains opened.'],
      ['bathroom-leakage', 'Bathroom pipe leakage', 'QUOTATION', null, 90, 'Concealed leaks that need opening the line.'],
    ],
  },
  {
    slug: 'water-fitting',
    name: 'Water fitting',
    description: 'Pipelines, tanks, and motor pumps.',
    services: [
      ['pipeline-leak-repair', 'Pipeline leak repair', 'FIXED', 44900, 75, 'Exposed pipe leaks cut out and rejoined.'],
      ['overhead-tank', 'Overhead tank connection', 'QUOTATION', null, 120, 'New tank inlet, outlet, and overflow.'],
      ['motor-pump-repair', 'Motor pump repair', 'QUOTATION', null, 90, 'Borewell and monoblock pumps that will not start.'],
    ],
  },
  {
    slug: 'ro',
    name: 'RO and purifiers',
    description: 'Service, filters, and new installations.',
    services: [
      ['ro-service', 'RO general service', 'FIXED', 49900, 60, 'Service visit. Filters are extra if they need replacing.'],
      ['filter-replacement', 'Filter and membrane replacement', 'FIXED', 89900, 60, 'Standard domestic RO filters and membrane.'],
      ['ro-installation', 'New RO installation', 'QUOTATION', null, 90, 'Wall mount, inlet, and drain for a new purifier.'],
    ],
  },
  {
    slug: 'appliance',
    name: 'Appliance repair',
    description: 'Geysers and washing machines.',
    services: [
      ['geyser-service', 'Geyser service', 'FIXED', 39900, 60, 'Heating, thermostat, and safety valve check.'],
      ['washing-machine', 'Washing machine not spinning', 'QUOTATION', null, 90, 'Diagnosis first. Parts are quoted before fitting.'],
    ],
  },
  {
    slug: 'carpenter',
    name: 'Carpenter',
    description: 'Doors, locks, and furniture.',
    services: [
      ['door-lock-repair', 'Door lock and hinge repair', 'FIXED', 34900, 60, 'Sagging doors, seized locks, and loose hinges.'],
      ['furniture-repair', 'Furniture repair', 'QUOTATION', null, 90, 'Beds, shutters, and cabinets that need more than a screw.'],
    ],
  },
  {
    slug: 'cleaning',
    name: 'Deep cleaning',
    description: 'Kitchens and bathrooms, done properly.',
    services: [
      ['bathroom-deep-clean', 'Bathroom deep clean', 'FIXED', 69900, 90, 'One bathroom, fittings, tiles, and floor.'],
      ['kitchen-deep-clean', 'Kitchen deep clean', 'FIXED', 79900, 120, 'Counters, tiles, sink, and appliance exteriors.'],
    ],
  },
] as const

const providers = [
  { id: 'usr_raju', phone: '+919000000011', name: 'Raju Verma', skills: ['electrician'], area: 'C-Scheme', lat: 26.908, lng: 75.81, rating: 4.8, jobs: 126, years: 11 },
  { id: 'usr_imran', phone: '+919000000012', name: 'Imran Khan', skills: ['plumber'], area: 'Vaishali Nagar', lat: 26.912, lng: 75.748, rating: 4.7, jobs: 98, years: 9 },
  { id: 'usr_suresh', phone: '+919000000013', name: 'Suresh Yadav', skills: ['water-fitting'], area: 'Mansarovar', lat: 26.858, lng: 75.768, rating: 4.6, jobs: 74, years: 14 },
  { id: 'usr_priya', phone: '+919000000014', name: 'Priya Joshi', skills: ['ro'], area: 'Raja Park', lat: 26.901, lng: 75.824, rating: 4.9, jobs: 151, years: 8 },
  { id: 'usr_anita', phone: '+919000000015', name: 'Anita Sharma', skills: ['electrician', 'plumber'], area: 'Jagatpura', lat: 26.84, lng: 75.805, rating: 4.5, jobs: 63, years: 7 },
]

async function main() {
  const city = await prisma.city.upsert({
    where: { slug: 'jaipur' },
    update: { isActive: true, serviceRadiusKm: 30 },
    create: {
      id: 'city_jaipur',
      name: 'Jaipur',
      slug: 'jaipur',
      state: 'Rajasthan',
      centerLat: 26.9124,
      centerLng: 75.7873,
      serviceRadiusKm: 30,
    },
  })

  const serviceIds = new Map<string, string>()
  for (const [index, category] of catalog.entries()) {
    const savedCategory = await prisma.serviceCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description, sortOrder: index, isActive: true },
      create: { slug: category.slug, name: category.name, description: category.description, sortOrder: index },
    })
    for (const [order, service] of category.services.entries()) {
      const [slug, name, pricingType, pricePaise, minutes, description] = service
      const saved = await prisma.service.upsert({
        where: { slug },
        update: { name, description, pricingType, estimatedMinutes: minutes, isActive: true, sortOrder: order },
        create: {
          categoryId: savedCategory.id,
          slug,
          name,
          description,
          highlights: ['Verified professional', 'Pay after the work', pricingType === 'FIXED' ? 'Fixed Jaipur price' : 'Quote before work starts'],
          pricingType,
          estimatedMinutes: minutes,
          sortOrder: order,
        },
      })
      serviceIds.set(slug, saved.id)
      await prisma.cityServicePrice.upsert({
        where: { cityId_serviceId: { cityId: city.id, serviceId: saved.id } },
        update: { pricePaise, commissionBps: 1500, isActive: true },
        create: { cityId: city.id, serviceId: saved.id, pricePaise, commissionBps: 1500 },
      })
    }
  }

  await prisma.user.upsert({
    where: { phone_role: { phone: '+919000000001', role: 'ADMIN' } },
    update: { name: 'Aangan Ops', isActive: true },
    create: { id: 'usr_admin', phone: '+919000000001', role: 'ADMIN', name: 'Aangan Ops' },
  })
  const meera = await prisma.user.upsert({
    where: { phone_role: { phone: '+919000000002', role: 'CUSTOMER' } },
    update: { name: 'Meera Sharma', isActive: true },
    create: { id: 'usr_meera', phone: '+919000000002', role: 'CUSTOMER', name: 'Meera Sharma' },
  })
  await prisma.address.upsert({
    where: { id: 'addr_meera_home' },
    update: {},
    create: {
      id: 'addr_meera_home',
      userId: meera.id,
      label: 'Home',
      line1: '42, Malviya Nagar',
      landmark: 'Near the World Trade Park road',
      areaLabel: 'Malviya Nagar',
      lat: 26.8547,
      lng: 75.804,
      cityId: city.id,
      isDefault: true,
    },
  })

  const secret = process.env.FIELD_ENCRYPTION_KEY
  if (!secret) throw new Error('FIELD_ENCRYPTION_KEY is required')

  for (const [index, provider] of providers.entries()) {
    const user = await prisma.user.upsert({
      where: { phone_role: { phone: provider.phone, role: 'PROVIDER' } },
      update: { name: provider.name, isActive: true },
      create: { id: provider.id, phone: provider.phone, role: 'PROVIDER', name: provider.name },
    })
    const profile = await prisma.providerProfile.upsert({
      where: { userId: user.id },
      update: {
        kycStatus: 'APPROVED',
        ratingAvg: provider.rating,
        ratingCount: 40 + index * 7,
        jobsCompleted: provider.jobs,
        experienceYears: provider.years,
        bio: `${provider.name.split(' ')[0]} takes ${provider.skills.join(' and ')} jobs across ${provider.area}.`,
        accountName: provider.name,
        accountNumberEnc: encryptField(`12345678901${index}`, secret),
        accountLast4: `901${index}`,
        ifsc: 'SBIN0001234',
        upiId: `${provider.name.split(' ')[0].toLowerCase()}@oksbi`,
      },
      create: {
        userId: user.id,
        kycStatus: 'APPROVED',
        ratingAvg: provider.rating,
        ratingCount: 40 + index * 7,
        jobsCompleted: provider.jobs,
        experienceYears: provider.years,
        bio: `${provider.name.split(' ')[0]} takes ${provider.skills.join(' and ')} jobs across ${provider.area}.`,
        accountName: provider.name,
        accountNumberEnc: encryptField(`12345678901${index}`, secret),
        accountLast4: `901${index}`,
        ifsc: 'SBIN0001234',
        upiId: `${provider.name.split(' ')[0].toLowerCase()}@oksbi`,
      },
    })
    await prisma.$executeRaw`
      UPDATE provider_profiles SET
        is_online = true,
        current_lat = ${provider.lat},
        current_lng = ${provider.lng},
        last_location_at = NOW(),
        location = ST_SetSRID(ST_MakePoint(${provider.lng}, ${provider.lat}), 4326)::geography
      WHERE id = ${profile.id}
    `
    const matched = servicesFor(provider.skills, serviceIds)
    await prisma.providerSkill.deleteMany({ where: { profileId: profile.id, serviceId: { notIn: matched } } })
    for (const serviceId of matched) {
      await prisma.providerSkill.upsert({
        where: { profileId_serviceId: { profileId: profile.id, serviceId } },
        update: {},
        create: { profileId: profile.id, serviceId },
      })
    }
    await prisma.providerServiceArea.deleteMany({ where: { profileId: profile.id } })
    await prisma.providerServiceArea.create({
      data: { profileId: profile.id, cityId: city.id, label: provider.area, baseLat: provider.lat, baseLng: provider.lng, radiusKm: 18 },
    })
    for (let day = 0; day < 7; day += 1) {
      await prisma.providerAvailability.upsert({
        where: { profileId_dayOfWeek: { profileId: profile.id, dayOfWeek: day } },
        update: { startMin: 8 * 60, endMin: 20 * 60, isActive: true },
        create: { profileId: profile.id, dayOfWeek: day, startMin: 8 * 60, endMin: 20 * 60 },
      })
    }
    for (const type of ['AADHAAR', 'PAN', 'SELFIE'] as const) {
      await prisma.providerDocument.upsert({
        where: { profileId_type: { profileId: profile.id, type } },
        update: { status: 'APPROVED' },
        create: { profileId: profile.id, type, storageKey: 'seed:verified', status: 'APPROVED' },
      })
    }
  }

  const history = [
    ['bkg_seed_01', 'usr_raju', 'ceiling-fan-installation', 12],
    ['bkg_seed_02', 'usr_imran', 'drain-blockage', 10],
    ['bkg_seed_03', 'usr_priya', 'ro-service', 8],
    ['bkg_seed_04', 'usr_suresh', 'pipeline-leak-repair', 6],
    ['bkg_seed_05', 'usr_anita', 'switch-socket-repair', 4],
    ['bkg_seed_06', 'usr_raju', 'mcb-replacement', 2],
  ] as const

  for (const [id, providerId, slug, daysAgo] of history) {
    const serviceId = serviceIds.get(slug)
    if (!serviceId) continue
    const price = await prisma.cityServicePrice.findUnique({ where: { cityId_serviceId: { cityId: city.id, serviceId } }, include: { service: true } })
    if (!price?.pricePaise) continue
    const when = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    const split = splitAmount(price.pricePaise, price.commissionBps)
    const booking = await prisma.booking.upsert({
      where: { id },
      update: {},
      create: {
        id,
        customerId: meera.id,
        providerId,
        serviceId,
        cityId: city.id,
        addressId: 'addr_meera_home',
        serviceName: price.service.name,
        pricingType: 'FIXED',
        mode: 'INSTANT',
        status: 'PAID',
        issueDescription: 'Seeded completed visit so reports and earnings have history.',
        searchExpiresAt: when,
        addressLine: '42, Malviya Nagar',
        areaLabel: 'Malviya Nagar',
        lat: 26.8547,
        lng: 75.804,
        pricePaise: price.pricePaise,
        commissionBps: price.commissionBps,
        acceptedAt: when,
        completedAt: new Date(when.getTime() + 60 * 60 * 1000),
        paidAt: new Date(when.getTime() + 2 * 60 * 60 * 1000),
        createdAt: when,
      },
    })
    await prisma.payment.upsert({
      where: { id: `pay_${id}` },
      update: {},
      create: {
        id: `pay_${id}`,
        bookingId: booking.id,
        amountPaise: price.pricePaise,
        commissionPaise: split.commissionPaise,
        gstPaise: split.gstPaise,
        providerPaise: split.providerPaise,
        status: 'CAPTURED',
        method: 'upi',
        razorpayOrderId: `seed_order_${id}`,
        razorpayPaymentId: `seed_pay_${id}`,
        capturedAt: booking.paidAt,
        createdAt: when,
      },
    })
    await prisma.ledgerEntry.upsert({
      where: { dedupeKey: `earn:pay_${id}` },
      update: {},
      create: {
        providerId,
        bookingId: booking.id,
        amountPaise: split.providerPaise,
        memo: `Earning for ${price.service.name}`,
        dedupeKey: `earn:pay_${id}`,
        createdAt: booking.paidAt ?? when,
      },
    })
    await prisma.review.upsert({
      where: { bookingId: booking.id },
      update: {},
      create: { bookingId: booking.id, customerId: meera.id, providerId, rating: 5, comment: 'Reached on time and left the place clean.' },
    })
  }

  console.log('Aangan seed ready. Jaipur is live.')
  console.log('Admin 9000000001 · Customer 9000000002 · Pros 9000000011–015 · OTP 123456')
}

function servicesFor(skills: string[], serviceIds: Map<string, string>) {
  const prefixes: Record<string, string[]> = {
    electrician: ['ceiling-fan', 'switch-socket', 'mcb-', 'wiring-'],
    plumber: ['tap-mixer', 'flush-', 'drain-', 'bathroom-leakage'],
    'water-fitting': ['pipeline-', 'overhead-', 'motor-'],
    ro: ['ro-', 'filter-'],
  }
  return [...serviceIds.entries()]
    .filter(([slug]) => skills.some((skill) => (prefixes[skill] ?? []).some((prefix) => slug.startsWith(prefix))))
    .map(([, id]) => id)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
