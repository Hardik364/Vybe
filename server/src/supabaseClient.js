/**
 * dbClient.js (kept as supabaseClient.js for import compatibility)
 * PostgreSQL client via `pg` — works with Neon, Railway, or any Postgres URL.
 */
import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

let pool = null

if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // required for Neon / hosted Postgres
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
    })
    pool.on('error', (err) => console.error('[DB] Pool error:', err.message))
    console.log('[DB] PostgreSQL pool initialised')
} else {
    console.warn('[DB] ⚠️  DATABASE_URL not set — DB features disabled')
}

export default pool
