import 'dotenv/config'
import { join } from 'path'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/http'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((origin) => origin.trim()).filter(Boolean)
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origins.includes(origin)) {
        callback(null, true)
        return
      }
      let allowed = false
      if (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true') {
        try {
          const url = new URL(origin)
          const host = url.hostname
          const lan = host === 'localhost' || host === '127.0.0.1' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)
          const renderDemo = process.env.DEMO_MODE === 'true' && url.protocol === 'https:' && host.endsWith('.onrender.com')
          allowed = lan || renderDemo
        } catch {
          allowed = false
        }
      }
      callback(null, allowed)
    },
    credentials: true,
  })
  app.setGlobalPrefix('v1')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  app.useGlobalFilters(new AllExceptionsFilter())
  app.useStaticAssets(join(process.cwd(), process.env.STORAGE_DIR ?? 'uploads', 'public'), { prefix: '/uploads' })
  const config = new DocumentBuilder()
    .setTitle('Aangan API')
    .setDescription('Home services marketplace for Jaipur and the next cities.')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config))
  app.enableShutdownHooks()
  if (process.env.DEMO_MODE === 'true') {
    console.warn('DEMO_MODE is on. Code 123456 signs in to the public demo accounts.')
  }
  const port = Number(process.env.PORT ?? 4000)
  await app.listen(port)
  console.log(`Aangan API listening on http://localhost:${port}`)
  console.log(`OpenAPI docs at http://localhost:${port}/docs`)
}

bootstrap()
