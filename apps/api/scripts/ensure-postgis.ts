import 'dotenv/config'
import { Client } from 'pg'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required')
  const client = new Client({ connectionString })
  try {
    await client.connect()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not connect to Postgres. Start it with: docker compose up -d db\n${message}`)
  }
  await client.query('CREATE EXTENSION IF NOT EXISTS postgis')
  if (process.argv.includes('--index')) {
    await client.query(
      'CREATE INDEX IF NOT EXISTS provider_profiles_location_gix ON provider_profiles USING GIST (location)',
    )
  }
  await client.end()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
