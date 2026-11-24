import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'
import { AuthUser, fail, IS_PUBLIC } from '../common/http'
import { PrismaService } from '../prisma/prisma.service'
import { HttpStatus } from '@nestjs/common'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    if (context.getType() !== 'http') return true

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>()
    const header = request.header('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) fail(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Sign in to continue')

    let payload: { sub?: string; role?: AuthUser['role'] }
    try {
      payload = await this.jwt.verifyAsync(token)
    } catch {
      fail(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Your session has expired. Sign in again.')
    }

    if (!payload.sub) fail(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Sign in to continue')
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || !user.isActive) {
      fail(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'This account is not active')
    }
    request.user = { id: user.id, role: user.role, phone: user.phone, name: user.name }
    return true
  }
}
