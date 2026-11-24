import {
  ArgumentsHost,
  Catch,
  createParamDecorator,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  SetMetadata,
} from '@nestjs/common'
import { Request, Response } from 'express'

export type AuthUser = {
  id: string
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN'
  phone: string
  name: string | null
}

export const IS_PUBLIC = 'isPublic'
export const ROLES_KEY = 'roles'
export const Public = () => SetMetadata(IS_PUBLIC, true)
export const Roles = (...roles: AuthUser['role'][]) => SetMetadata(ROLES_KEY, roles)
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user
})

export function fail(status: HttpStatus, code: string, message: string): never {
  throw new HttpException({ code, message, error: code }, status)
}

export function pageOf(page?: number, pageSize?: number) {
  const safePage = Math.max(1, page ?? 1)
  const safeSize = Math.min(50, Math.max(1, pageSize ?? 20))
  return { page: safePage, pageSize: safeSize, skip: (safePage - 1) * safeSize, take: safeSize }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      this.logger.error(exception)
      return
    }
    const response = host.switchToHttp().getResponse<Response>()
    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let code = 'INTERNAL'
    let message = 'Something went wrong'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const body = exception.getResponse()
      if (typeof body === 'string') {
        message = body
      } else if (typeof body === 'object' && body) {
        const record = body as { message?: string | string[]; code?: string; error?: string }
        message = Array.isArray(record.message) ? record.message.join(', ') : record.message ?? message
        code = record.code ?? record.error ?? code
      }
    } else if (typeof exception === 'object' && exception && 'code' in exception && (exception as { code?: string }).code === 'P2002') {
      status = HttpStatus.CONFLICT
      code = 'CONFLICT'
      message = 'That record already exists'
    } else {
      this.logger.error(exception)
    }

    response.status(status).json({ error: { code, message, status } })
  }
}
