import { existsSync } from 'fs'
import { join } from 'path'
import { HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthUser, fail } from '../common/http'
import { encryptField, maskAccount, maskUpi } from '../domain/crypto'
import { NotifyService } from '../infra/notify.service'
import { PrismaService } from '../prisma/prisma.service'

const FILE_NAME = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i
const REQUIRED_DOCS = ['AADHAAR', 'PAN', 'SELFIE'] as const

type OnboardingInput = {
  name: string
  bio?: string
  experienceYears: number
  serviceIds: string[]
  cityId: string
  areaLabel: string
  baseLat: number
  baseLng: number
  radiusKm: number
  accountName: string
  accountNumber: string
  ifsc: string
  upiId?: string
  documents: Array<{ type: 'AADHAAR' | 'PAN' | 'SELFIE'; fileId: string }>
}

@Injectable()
export class ProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notify: NotifyService,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: { skills: { include: { service: true } }, areas: true, availability: true, documents: true },
    })
    if (!profile) return { user, profile: null }
    return {
      user: { id: user?.id, name: user?.name, phone: user?.phone },
      profile: {
        kycStatus: profile.kycStatus,
        rejectionReason: profile.rejectionReason,
        bio: profile.bio,
        experienceYears: profile.experienceYears,
        ratingAvg: profile.ratingAvg,
        ratingCount: profile.ratingCount,
        jobsCompleted: profile.jobsCompleted,
        isOnline: profile.isOnline,
        accountLast4: maskAccount(profile.accountLast4),
        ifsc: profile.ifsc,
        upiId: maskUpi(profile.upiId),
        skills: profile.skills.map((skill) => ({ id: skill.serviceId, name: skill.service.name })),
        areas: profile.areas,
        availability: profile.availability,
        documents: profile.documents.map((document) => ({ id: document.id, type: document.type, status: document.status })),
      },
    }
  }

  async onboard(user: AuthUser, input: OnboardingInput) {
    if (user.role !== 'PROVIDER') fail(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Only professionals can onboard')
    const city = await this.prisma.city.findFirst({ where: { id: input.cityId, isActive: true } })
    if (!city) fail(HttpStatus.BAD_REQUEST, 'CITY_UNAVAILABLE', 'Choose a live city')
    const services = await this.prisma.service.findMany({ where: { id: { in: input.serviceIds }, isActive: true } })
    if (services.length !== new Set(input.serviceIds).size) {
      fail(HttpStatus.BAD_REQUEST, 'UNKNOWN_SERVICE', 'One or more skills are not available')
    }
    const types = new Set(input.documents.map((document) => document.type))
    if (REQUIRED_DOCS.some((type) => !types.has(type))) {
      fail(HttpStatus.BAD_REQUEST, 'KYC_INCOMPLETE', 'Upload Aadhaar, PAN, and a selfie')
    }
    input.documents.forEach((document) => this.assertPrivateFile(document.fileId))
    const ifsc = input.ifsc.toUpperCase()
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) fail(HttpStatus.BAD_REQUEST, 'INVALID_IFSC', 'Enter a valid IFSC')
    if (!/^\d{9,18}$/.test(input.accountNumber)) fail(HttpStatus.BAD_REQUEST, 'INVALID_ACCOUNT', 'Enter a valid account number')

    await this.prisma.user.update({ where: { id: user.id }, data: { name: input.name.trim() } })
    const existing = await this.prisma.providerProfile.findUnique({ where: { userId: user.id }, include: { documents: true } })
    const documentsChanged = input.documents.some((document) => {
      const current = existing?.documents.find((row) => row.type === document.type)
      return current?.storageKey !== document.fileId
    })
    const kycStatus = existing?.kycStatus === 'APPROVED' && !documentsChanged ? 'APPROVED' : 'SUBMITTED'
    const secret = this.config.getOrThrow<string>('FIELD_ENCRYPTION_KEY')
    const profile = await this.prisma.providerProfile.upsert({
      where: { userId: user.id },
      update: {
        bio: input.bio,
        experienceYears: input.experienceYears,
        kycStatus,
        rejectionReason: kycStatus === 'SUBMITTED' ? null : existing?.rejectionReason,
        isOnline: kycStatus === 'APPROVED' ? existing?.isOnline : false,
        accountName: input.accountName,
        accountNumberEnc: encryptField(input.accountNumber, secret),
        accountLast4: input.accountNumber.slice(-4),
        ifsc,
        upiId: input.upiId,
      },
      create: {
        userId: user.id,
        bio: input.bio,
        experienceYears: input.experienceYears,
        kycStatus: 'SUBMITTED',
        accountName: input.accountName,
        accountNumberEnc: encryptField(input.accountNumber, secret),
        accountLast4: input.accountNumber.slice(-4),
        ifsc,
        upiId: input.upiId,
      },
    })
    await this.prisma.providerSkill.deleteMany({ where: { profileId: profile.id, serviceId: { notIn: input.serviceIds } } })
    for (const serviceId of input.serviceIds) {
      await this.prisma.providerSkill.upsert({
        where: { profileId_serviceId: { profileId: profile.id, serviceId } },
        update: {},
        create: { profileId: profile.id, serviceId },
      })
    }
    await this.prisma.providerServiceArea.deleteMany({ where: { profileId: profile.id } })
    await this.prisma.providerServiceArea.create({
      data: {
        profileId: profile.id,
        cityId: input.cityId,
        label: input.areaLabel,
        baseLat: input.baseLat,
        baseLng: input.baseLng,
        radiusKm: input.radiusKm,
      },
    })
    for (const document of input.documents) {
      await this.prisma.providerDocument.upsert({
        where: { profileId_type: { profileId: profile.id, type: document.type } },
        update: { storageKey: document.fileId, status: kycStatus === 'APPROVED' ? 'APPROVED' : 'PENDING' },
        create: { profileId: profile.id, type: document.type, storageKey: document.fileId },
      })
    }
    const days = await this.prisma.providerAvailability.count({ where: { profileId: profile.id } })
    if (days === 0) {
      await this.prisma.providerAvailability.createMany({
        data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          profileId: profile.id,
          dayOfWeek,
          startMin: 8 * 60,
          endMin: 20 * 60,
        })),
      })
    }
    return this.me(user.id)
  }

  async availability(userId: string, days: Array<{ dayOfWeek: number; startMin: number; endMin: number; isActive: boolean }>) {
    const profile = await this.requireProfile(userId)
    for (const day of days) {
      if (day.startMin < 0 || day.endMin > 24 * 60 || day.startMin >= day.endMin) {
        fail(HttpStatus.BAD_REQUEST, 'INVALID_HOURS', 'Check the start and end time')
      }
      await this.prisma.providerAvailability.upsert({
        where: { profileId_dayOfWeek: { profileId: profile.id, dayOfWeek: day.dayOfWeek } },
        update: { startMin: day.startMin, endMin: day.endMin, isActive: day.isActive },
        create: { profileId: profile.id, ...day },
      })
    }
    return this.me(userId)
  }

  async presence(userId: string, isOnline: boolean, lat?: number, lng?: number) {
    const profile = await this.requireProfile(userId)
    if (isOnline) {
      if (profile.kycStatus !== 'APPROVED') fail(HttpStatus.FORBIDDEN, 'KYC_PENDING', 'You can go online after verification')
      if (lat == null || lng == null) fail(HttpStatus.BAD_REQUEST, 'LOCATION_REQUIRED', 'Turn on location to go online')
      await this.prisma.$executeRaw`
        UPDATE provider_profiles SET
          is_online = true,
          current_lat = ${lat},
          current_lng = ${lng},
          last_location_at = NOW(),
          location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          updated_at = NOW()
        WHERE user_id = ${userId}
      `
    } else {
      await this.prisma.providerProfile.update({ where: { userId }, data: { isOnline: false } })
    }
    return this.me(userId)
  }

  async earnings(userId: string) {
    const [entries, payouts, aggregate] = await Promise.all([
      this.prisma.ledgerEntry.findMany({ where: { providerId: userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.payout.findMany({ where: { providerId: userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.ledgerEntry.aggregate({ where: { providerId: userId }, _sum: { amountPaise: true } }),
    ])
    const pending = payouts.filter((payout) => payout.status === 'PENDING').reduce((sum, payout) => sum + payout.amountPaise, 0)
    const balance = aggregate._sum.amountPaise ?? 0
    return { balancePaise: balance, availablePaise: balance - pending, entries, payouts }
  }

  async reviewKyc(actorId: string, userId: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } })
    if (!profile || profile.kycStatus !== 'SUBMITTED') {
      fail(HttpStatus.CONFLICT, 'KYC_NOT_READY', 'This profile is not waiting for review')
    }
    if (status === 'REJECTED' && !reason) fail(HttpStatus.BAD_REQUEST, 'REASON_REQUIRED', 'Add a reason for the rejection')
    await this.prisma.$transaction([
      this.prisma.providerProfile.update({
        where: { id: profile.id },
        data: { kycStatus: status, rejectionReason: status === 'REJECTED' ? reason : null, isOnline: false },
      }),
      this.prisma.providerDocument.updateMany({
        where: { profileId: profile.id },
        data: { status: status === 'APPROVED' ? 'APPROVED' : 'REJECTED' },
      }),
      this.prisma.auditLog.create({
        data: { actorId, action: `kyc.${status.toLowerCase()}`, entityType: 'provider', entityId: userId, metadata: { reason } },
      }),
    ])
    await this.notify.user(
      userId,
      status === 'APPROVED' ? 'You are verified' : 'Verification needs a change',
      status === 'APPROVED' ? 'You can go online and receive jobs in your service area.' : reason!,
    )
    return { ok: true }
  }

  async payoutDetails(actorId: string, userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId }, include: { user: true } })
    if (!profile?.accountNumberEnc) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'No payout account on file')
    const { decryptField } = await import('../domain/crypto')
    await this.prisma.auditLog.create({
      data: { actorId, action: 'payout.reveal', entityType: 'provider', entityId: userId, metadata: {} },
    })
    return {
      accountName: profile.accountName,
      accountNumber: decryptField(profile.accountNumberEnc, this.config.getOrThrow<string>('FIELD_ENCRYPTION_KEY')),
      ifsc: profile.ifsc,
      upiId: profile.upiId,
      phone: profile.user.phone,
      name: profile.user.name,
    }
  }

  private async requireProfile(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } })
    if (!profile) fail(HttpStatus.CONFLICT, 'ONBOARDING_REQUIRED', 'Finish your profile before going online')
    return profile
  }

  private assertPrivateFile(fileId: string) {
    if (!FILE_NAME.test(fileId)) fail(HttpStatus.BAD_REQUEST, 'INVALID_FILE', 'Upload the document again')
    const path = join(process.cwd(), this.config.get<string>('STORAGE_DIR') ?? 'uploads', 'private', fileId)
    if (!existsSync(path)) fail(HttpStatus.BAD_REQUEST, 'INVALID_FILE', 'Upload the document again')
  }
}
