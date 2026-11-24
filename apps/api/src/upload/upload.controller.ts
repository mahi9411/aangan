import { randomUUID } from 'crypto'
import { mkdirSync } from 'fs'
import { extname, join } from 'path'
import { Controller, Get, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { diskStorage } from 'multer'
import { Response } from 'express'
import { createReadStream, existsSync } from 'fs'
import { AuthUser, CurrentUser, fail, Roles } from '../common/http'
import { HttpStatus } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

@ApiTags('uploads')
@ApiBearerAuth()
@Controller()
export class UploadController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!TYPES[file.mimetype]) cb(new Error('Use a JPEG, PNG, or WEBP image'), false)
        else cb(null, true)
      },
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const purpose = String(req.query.purpose ?? 'booking')
          const root = join(process.cwd(), process.env.STORAGE_DIR ?? 'uploads', purpose === 'kyc' ? 'private' : 'public')
          mkdirSync(root, { recursive: true })
          cb(null, root)
        },
        filename: (_req, file, cb) => cb(null, `${randomUUID()}.${TYPES[file.mimetype] ?? 'jpg'}`),
      }),
    }),
  )
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File, @Query('purpose') purpose = 'booking') {
    if (!file) fail(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED', 'Choose an image')
    if (purpose === 'kyc' && user.role !== 'PROVIDER') fail(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Only professionals upload KYC')
    if (purpose === 'kyc') return { fileId: file.filename, visibility: 'private' }
    const base = this.config.getOrThrow<string>('PUBLIC_BASE_URL').replace(/\/$/, '')
    return { url: `${base}/uploads/${file.filename}`, visibility: 'public' }
  }

  @Roles('PROVIDER')
  @Get('provider/documents/:id/file')
  async ownFile(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() response: Response) {
    const document = await this.prisma.providerDocument.findFirst({ where: { id, profile: { userId: user.id } } })
    if (!document) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Document not found')
    this.stream(document.storageKey, response)
  }

  @Roles('ADMIN')
  @Get('admin/documents/:id/file')
  async adminFile(@Param('id') id: string, @Res() response: Response) {
    const document = await this.prisma.providerDocument.findUnique({ where: { id } })
    if (!document) fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Document not found')
    this.stream(document.storageKey, response)
  }

  private stream(storageKey: string, response: Response) {
    if (storageKey.startsWith('seed:')) {
      response.status(404).json({ error: { code: 'SEED_DOCUMENT', message: 'This demo record was verified without a stored scan.', status: 404 } })
      return
    }
    const path = join(process.cwd(), this.config.get<string>('STORAGE_DIR') ?? 'uploads', 'private', storageKey)
    if (!existsSync(path) || storageKey.includes('..') || storageKey.includes('/') || storageKey.includes('\\')) {
      fail(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'File not found')
    }
    createReadStream(path).pipe(response)
  }
}
