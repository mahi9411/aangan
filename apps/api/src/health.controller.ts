import { Controller, Get } from '@nestjs/common'
import { Public } from './common/http'
import { PrismaService } from './prisma/prisma.service'

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  root() {
    return { service: 'aangan-api', health: '/v1/health', docs: '/docs' }
  }

  @Public()
  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`
    return { ok: true, service: 'aangan-api', time: new Date().toISOString() }
  }
}
