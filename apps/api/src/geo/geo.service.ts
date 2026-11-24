import { Injectable } from '@nestjs/common'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export type Candidate = { userId: string; profileId: string; distanceM: number }

type CandidateQuery = {
  mode: 'INSTANT' | 'SCHEDULED'
  serviceId: string
  cityId: string
  lat: number
  lng: number
  scheduledAt?: Date
  dayOfWeek?: number
  minuteOfDay?: number
  windowStart?: Date
  windowEnd?: Date
  onlyUserId?: string
  excludeBroadcastsForBookingId?: string
}

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  async listCandidates(query: CandidateQuery): Promise<Candidate[]> {
    const onlyUser = query.onlyUserId ? Prisma.sql`AND u.id = ${query.onlyUserId}` : Prisma.empty
    const excludeBroadcast = query.excludeBroadcastsForBookingId
      ? Prisma.sql`AND NOT EXISTS (
          SELECT 1 FROM booking_broadcasts bb
          WHERE bb.booking_id = ${query.excludeBroadcastsForBookingId} AND bb.provider_id = u.id
        )`
      : Prisma.empty

    const rows =
      query.mode === 'INSTANT'
        ? await this.instant(query, onlyUser, excludeBroadcast)
        : await this.scheduled(query, onlyUser, excludeBroadcast)

    return rows.map((row) => ({
      userId: row.user_id,
      profileId: row.profile_id,
      distanceM: Number(row.distance_m),
    }))
  }

  private instant(
    query: CandidateQuery,
    onlyUser: Prisma.Sql,
    excludeBroadcast: Prisma.Sql,
  ) {
    return this.prisma.$queryRaw<Array<{ user_id: string; profile_id: string; distance_m: number }>>`
      SELECT * FROM (
        SELECT DISTINCT ON (u.id)
          u.id AS user_id,
          pp.id AS profile_id,
          ST_Distance(pp.location, ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography) AS distance_m
        FROM provider_profiles pp
        JOIN users u ON u.id = pp.user_id
        JOIN provider_skills sk ON sk.profile_id = pp.id AND sk.service_id = ${query.serviceId}
        JOIN provider_service_areas ar ON ar.profile_id = pp.id AND ar.city_id = ${query.cityId}
        WHERE pp.kyc_status::text = 'APPROVED'
          AND u.is_active = true
          AND pp.is_online = true
          AND pp.location IS NOT NULL
          AND pp.last_location_at > NOW() - INTERVAL '20 minutes'
          AND ST_DWithin(
            pp.location,
            ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography,
            ar.radius_km * 1000
          )
          AND NOT EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.provider_id = u.id
              AND b.status::text IN ('ACCEPTED','QUOTATION_PENDING','QUOTATION_APPROVED','EN_ROUTE','IN_PROGRESS')
          )
          AND NOT EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.provider_id = u.id
              AND b.mode::text = 'SCHEDULED'
              AND b.scheduled_at IS NOT NULL
              AND b.status::text IN ('ACCEPTED','QUOTATION_PENDING','QUOTATION_APPROVED','EN_ROUTE','IN_PROGRESS','AWAITING_PAYMENT')
              AND b.scheduled_at < NOW() + INTERVAL '90 minutes'
              AND b.scheduled_at > NOW() - INTERVAL '30 minutes'
          )
          ${excludeBroadcast}
          ${onlyUser}
        ORDER BY u.id, distance_m
      ) candidates
      ORDER BY distance_m
      LIMIT 25
    `
  }

  private scheduled(
    query: CandidateQuery,
    onlyUser: Prisma.Sql,
    excludeBroadcast: Prisma.Sql,
  ) {
    return this.prisma.$queryRaw<Array<{ user_id: string; profile_id: string; distance_m: number }>>`
      SELECT * FROM (
        SELECT DISTINCT ON (u.id)
          u.id AS user_id,
          pp.id AS profile_id,
          (
            6371000 * acos(
              LEAST(1::float8, GREATEST(-1::float8,
                cos(radians(${query.lat})) * cos(radians(ar.base_lat))
                * cos(radians(ar.base_lng) - radians(${query.lng}))
                + sin(radians(${query.lat})) * sin(radians(ar.base_lat))
              ))
            )
          ) AS distance_m
        FROM provider_profiles pp
        JOIN users u ON u.id = pp.user_id
        JOIN provider_skills sk ON sk.profile_id = pp.id AND sk.service_id = ${query.serviceId}
        JOIN provider_service_areas ar ON ar.profile_id = pp.id AND ar.city_id = ${query.cityId}
        WHERE pp.kyc_status::text = 'APPROVED'
          AND u.is_active = true
          AND (
            6371000 * acos(
              LEAST(1::float8, GREATEST(-1::float8,
                cos(radians(${query.lat})) * cos(radians(ar.base_lat))
                * cos(radians(ar.base_lng) - radians(${query.lng}))
                + sin(radians(${query.lat})) * sin(radians(ar.base_lat))
              ))
            )
          ) <= ar.radius_km * 1000
          AND EXISTS (
            SELECT 1 FROM provider_availability av
            WHERE av.profile_id = pp.id
              AND av.is_active = true
              AND av.day_of_week = ${query.dayOfWeek ?? -1}
              AND av.start_min <= ${query.minuteOfDay ?? -1}
              AND av.end_min >= ${query.minuteOfDay ?? -1}
          )
          AND NOT EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.provider_id = u.id
              AND b.scheduled_at IS NOT NULL
              AND b.status::text IN ('ACCEPTED','QUOTATION_PENDING','QUOTATION_APPROVED','EN_ROUTE','IN_PROGRESS','AWAITING_PAYMENT')
              AND b.scheduled_at >= ${query.windowStart ?? new Date(0)}
              AND b.scheduled_at <= ${query.windowEnd ?? new Date(0)}
          )
          ${excludeBroadcast}
          ${onlyUser}
        ORDER BY u.id, distance_m
      ) candidates
      ORDER BY distance_m
      LIMIT 25
    `
  }
}
