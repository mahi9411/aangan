import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto'
import { HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { fail } from '../common/http'
import { normalizeIndianMobile } from '../domain/phone'
import { SmsService } from '../infra/sms.service'
import { PrismaService } from '../prisma/prisma.service'

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sms: SmsService,
    private readonly config: ConfigService,
  ) {}

  async requestOtp(rawPhone: string, role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN') {
    const phone = this.phone(rawPhone)
    if (role === 'ADMIN') {
      const admin = await this.prisma.user.findUnique({ where: { phone_role: { phone, role: 'ADMIN' } } })
      if (!admin) return { sent: true, expiresInSec: 300 }
    }
    const since = new Date(Date.now() - 10 * 60 * 1000)
    const recent = await this.prisma.otpChallenge.count({ where: { phone, createdAt: { gt: since } } })
    if (recent >= 5) fail(HttpStatus.TOO_MANY_REQUESTS, 'OTP_RATE_LIMIT', 'Too many codes. Wait a few minutes.')

    const dev = this.config.get<string>('ALLOW_DEV_OTP') === 'true'
    const code = dev ? this.config.getOrThrow<string>('OTP_DEV_CODE') : String(randomInt(100000, 1000000))
    await this.prisma.otpChallenge.create({
      data: {
        phone,
        role,
        codeHash: this.hashCode(code),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })
    await this.sms.sendOtp(phone, code)
    return { sent: true, expiresInSec: 300, ...(dev ? { devCode: code } : {}) }
  }

  async verifyOtp(rawPhone: string, role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN', code: string, name?: string) {
    const phone = this.phone(rawPhone)
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, role, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!challenge) fail(HttpStatus.UNAUTHORIZED, 'OTP_EXPIRED', 'That code has expired. Request a new one.')
    if (challenge.attempts >= 5) fail(HttpStatus.UNAUTHORIZED, 'OTP_LOCKED', 'Too many attempts. Request a new code.')
    const expected = Buffer.from(challenge.codeHash)
    const actual = Buffer.from(this.hashCode(code))
    const matches = expected.length === actual.length && timingSafeEqual(expected, actual)
    if (!matches) {
      await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } })
      fail(HttpStatus.UNAUTHORIZED, 'OTP_INVALID', 'That code is incorrect.')
    }
    await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } })

    let user = await this.prisma.user.findUnique({ where: { phone_role: { phone, role } } })
    if (role === 'ADMIN' && !user) fail(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Sign in to continue')
    if (!user) {
      user = await this.prisma.user.create({ data: { phone, role, name: name?.trim() || null } })
    } else if (name?.trim() && !user.name) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { name: name.trim() } })
    }
    if (!user.isActive) fail(HttpStatus.FORBIDDEN, 'ACCOUNT_DISABLED', 'This account has been disabled')
    const tokens = await this.issue(user.id, user.role)
    return { ...tokens, user: this.present(user) }
  }

  async refresh(rawToken: string) {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hashToken(rawToken) } })
    if (!row) fail(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Sign in to continue')
    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      fail(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Sign in to continue')
    }
    if (row.expiresAt < new Date()) fail(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Sign in to continue')
    const user = await this.prisma.user.findUnique({ where: { id: row.userId } })
    if (!user?.isActive) fail(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'This account is not active')
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } })
    return this.issue(user.id, user.role)
  }

  async logout(rawToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return { ok: true }
  }

  async updateMe(userId: string, input: { name?: string; email?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name?.trim(),
        email: input.email?.trim() || undefined,
      },
    })
    return this.present(user)
  }

  async saveDevice(userId: string, token: string, platform: string) {
    await this.prisma.device.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform },
    })
    return { ok: true }
  }

  async removeDevice(userId: string, token: string) {
    await this.prisma.device.deleteMany({ where: { userId, token } })
    return { ok: true }
  }

  async notifications(userId: string) {
    const items = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    })
    return items
  }

  async markNotificationRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    })
    return { ok: true }
  }

  private async issue(userId: string, role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN') {
    const accessToken = await this.jwt.signAsync({ sub: userId, role })
    const refreshToken = randomBytes(48).toString('base64url')
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    })
    return { accessToken, refreshToken, expiresInSec: 900 }
  }

  private present(user: { id: string; phone: string; role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN'; name: string | null; email: string | null }) {
    return { id: user.id, phone: user.phone, role: user.role, name: user.name, email: user.email }
  }

  private phone(input: string) {
    try {
      return normalizeIndianMobile(input)
    } catch (error) {
      fail(HttpStatus.BAD_REQUEST, 'INVALID_PHONE', error instanceof Error ? error.message : 'Invalid phone')
    }
  }

  private hashCode(code: string) {
    return createHash('sha256').update(`${this.config.getOrThrow<string>('OTP_PEPPER')}:${code}`).digest('hex')
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }
}
