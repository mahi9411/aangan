import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthUser, fail, ROLES_KEY } from '../common/http'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AuthUser['role'][]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!roles?.length) return true
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>()
    if (!request.user || !roles.includes(request.user.role)) {
      fail(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'You do not have access to this')
    }
    return true
  }
}
