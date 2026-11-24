import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

type PushPayload = { title: string; body: string; data?: Record<string, string> }

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name)
  private fcmReady = false

  constructor(config: ConfigService) {
    const projectId = config.get<string>('FCM_PROJECT_ID')
    const clientEmail = config.get<string>('FCM_CLIENT_EMAIL')
    const privateKey = config.get<string>('FCM_PRIVATE_KEY')?.replace(/\\n/g, '\n')
    if (projectId && clientEmail && privateKey && !getApps().length) {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
      this.fcmReady = true
    } else if (projectId && clientEmail && privateKey) {
      this.fcmReady = true
    }
  }

  async send(tokens: string[], payload: PushPayload) {
    const unique = [...new Set(tokens.filter(Boolean))]
    if (!unique.length) return
    const expo = unique.filter((token) => token.startsWith('ExponentPushToken'))
    const fcm = unique.filter((token) => !token.startsWith('ExponentPushToken'))
    await Promise.allSettled([this.sendExpo(expo, payload), this.sendFcm(fcm, payload)])
  }

  private async sendExpo(tokens: string[], payload: PushPayload) {
    if (!tokens.length) return
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
          sound: 'default',
          priority: 'high',
        })),
      ),
    })
    if (!response.ok) this.logger.warn(`Expo push failed: ${response.status}`)
  }

  private async sendFcm(tokens: string[], payload: PushPayload) {
    if (!tokens.length) return
    if (!this.fcmReady) {
      this.logger.log(`FCM not configured. Skipped ${tokens.length} push(es): ${payload.title}`)
      return
    }
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    })
  }
}
