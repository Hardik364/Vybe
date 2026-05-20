/**
 * db.js — PostgreSQL database helpers (Neon-compatible via pg)
 *
 * All persistent user data lives here.
 * Redis is still used for ephemeral stuff (queues, sessions, rate-limits).
 */
import pool from './supabaseClient.js'

// Guard — if DB not configured, operations are no-ops
function guard(label) {
    if (!pool) {
        console.warn(`[DB] ${label} skipped — DATABASE_URL not configured`)
        return true
    }
    return false
}

// ── Users ─────────────────────────────────────────────────────

/**
 * Get user by email. Returns null if not found.
 */
export async function getUser(email) {
    if (guard('getUser')) return null
    try {
        const { rows } = await pool.query(
            'SELECT * FROM users WHERE email = $1 LIMIT 1',
            [email]
        )
        return rows[0] || null
    } catch (err) {
        console.error('[DB] getUser:', err.message)
        return null
    }
}

/**
 * Create or update a user on first OTP verification.
 * Uses upsert so re-verification doesn't overwrite the username.
 */
export async function upsertUser({ email, username, collegeDomain, state = null, gender = null }) {
    if (guard('upsertUser')) return null
    try {
        const { rows } = await pool.query(
            `INSERT INTO users (email, username, college_domain, last_seen_at, city, gender)
             VALUES ($1, $2, $3, NOW(), $4, $5)
             ON CONFLICT (email) DO UPDATE SET
               username        = COALESCE(EXCLUDED.username, users.username),
               college_domain  = COALESCE(EXCLUDED.college_domain, users.college_domain),
               last_seen_at    = NOW(),
               city            = COALESCE(EXCLUDED.city, users.city),
               gender          = COALESCE(EXCLUDED.gender, users.gender)
             RETURNING *`,
            [email, username, collegeDomain, state || null, gender || null]
        )
        console.log(`[DB] upsertUser OK — ${email} (${collegeDomain})`)
        return rows[0] || null
    } catch (err) {
        console.error('[DB] ❌ upsertUser FAILED:', err.message)
        console.error('[DB]    email:', email, '| column issue or connection problem')
        return null
    }
}

/**
 * Update user's last_seen_at timestamp (call on Socket.IO connect).
 */
export async function touchUser(email) {
    if (guard('touchUser') || !email) return
    try {
        await pool.query(
            'UPDATE users SET last_seen_at = NOW() WHERE email = $1',
            [email]
        )
    } catch (err) {
        console.error('[DB] touchUser:', err.message)
    }
}

/**
 * Update ABC verification status.
 */
export async function setAbcStatus(email, status, hash = null) {
    if (guard('setAbcStatus')) return
    try {
        await pool.query(
            'UPDATE users SET abc_status = $1, abc_hash = COALESCE($2, abc_hash) WHERE email = $3',
            [status, hash, email]
        )
    } catch (err) {
        console.error('[DB] setAbcStatus:', err.message)
    }
}

/**
 * Set user tier after payment confirmed.
 * Pass expiresAt = null to reset to free.
 */
export async function setUserTier(email, tier, expiresAt = null) {
    if (guard('setUserTier')) return
    try {
        await pool.query(
            'UPDATE users SET tier = $1, tier_expires_at = $2 WHERE email = $3',
            [tier, expiresAt, email]
        )
    } catch (err) {
        console.error('[DB] setUserTier:', err.message)
    }
}

/**
 * Ban or shadow-ban a user by email.
 */
export async function banUser(email, { shadowBan = false } = {}) {
    if (guard('banUser')) return
    try {
        if (shadowBan) {
            await pool.query('UPDATE users SET is_shadow_banned = TRUE WHERE email = $1', [email])
        } else {
            await pool.query('UPDATE users SET is_banned = TRUE WHERE email = $1', [email])
        }
    } catch (err) {
        console.error('[DB] banUser:', err.message)
    }
}

// ── Karma ─────────────────────────────────────────────────────

/**
 * Record a karma rating and update the aggregate.
 * rating: 'great' | 'okay' | 'disrespectful'
 */
export async function recordKarma(ratedEmail, rating, raterEmail = null) {
    if (guard('recordKarma')) return
    const VALID = ['great', 'okay', 'disrespectful']
    if (!VALID.includes(rating)) return
    try {
        await pool.query(
            'INSERT INTO karma_events (rated_email, rater_email, rating) VALUES ($1, $2, $3)',
            [ratedEmail, raterEmail, rating]
        )

        // Upsert aggregate — increment the right column
        await pool.query(
            `INSERT INTO karma (email, great, okay, disrespectful, total)
             VALUES ($1, $2, $3, $4, 1)
             ON CONFLICT (email) DO UPDATE SET
               great          = karma.great          + EXCLUDED.great,
               okay           = karma.okay           + EXCLUDED.okay,
               disrespectful  = karma.disrespectful  + EXCLUDED.disrespectful,
               total          = karma.total          + 1,
               updated_at     = NOW()`,
            [
                ratedEmail,
                rating === 'great' ? 1 : 0,
                rating === 'okay' ? 1 : 0,
                rating === 'disrespectful' ? 1 : 0,
            ]
        )
    } catch (err) {
        console.error('[DB] recordKarma:', err.message)
    }
}

/**
 * Get karma aggregate for an email.
 */
export async function getKarma(email) {
    if (guard('getKarma')) return { great: 0, okay: 0, disrespectful: 0, total: 0 }
    try {
        const { rows } = await pool.query(
            'SELECT * FROM karma WHERE email = $1 LIMIT 1',
            [email]
        )
        return rows[0] || { great: 0, okay: 0, disrespectful: 0, total: 0 }
    } catch (err) {
        console.error('[DB] getKarma:', err.message)
        return { great: 0, okay: 0, disrespectful: 0, total: 0 }
    }
}

/**
 * Check if user should be shadow banned (>20% disrespectful, min 5 ratings).
 */
export async function shouldShadowBan(email) {
    if (guard('shouldShadowBan')) return false
    const karma = await getKarma(email)
    if (karma.total < 5) return false
    return karma.disrespectful / karma.total > 0.2
}

// ── Reports ───────────────────────────────────────────────────

/**
 * File a report against a user.
 * Returns the total number of unique reporters for this user.
 */
export async function fileReport(reportedEmail, reporterEmail = null, reason = null) {
    if (guard('fileReport')) return 0
    try {
        await pool.query(
            'INSERT INTO reports (reported_email, reporter_email, reason) VALUES ($1, $2, $3)',
            [reportedEmail, reporterEmail, reason]
        )
        const { rows } = await pool.query(
            `SELECT COUNT(DISTINCT reporter_email) AS cnt
             FROM reports
             WHERE reported_email = $1 AND reporter_email IS NOT NULL`,
            [reportedEmail]
        )
        return parseInt(rows[0]?.cnt || '0', 10)
    } catch (err) {
        console.error('[DB] fileReport:', err.message)
        return 0
    }
}

// ── Subscriptions ─────────────────────────────────────────────

/**
 * Record a new subscription / payment.
 */
export async function createSubscription({ email, plan, amountPaise, razorpayOrderId }) {
    if (guard('createSubscription')) return null
    try {
        const { rows } = await pool.query(
            `INSERT INTO subscriptions (email, plan, amount_paise, razorpay_order_id, status)
             VALUES ($1, $2, $3, $4, 'pending')
             RETURNING *`,
            [email, plan, amountPaise, razorpayOrderId]
        )
        return rows[0] || null
    } catch (err) {
        console.error('[DB] createSubscription:', err.message)
        return null
    }
}

/**
 * Mark a subscription as active after payment confirmed.
 */
export async function activateSubscription(razorpayOrderId, razorpayPaymentId, expiresAt) {
    if (guard('activateSubscription')) return
    try {
        await pool.query(
            `UPDATE subscriptions
             SET razorpay_payment_id = $1, status = 'active',
                 starts_at = NOW(), expires_at = $2
             WHERE razorpay_order_id = $3`,
            [razorpayPaymentId, expiresAt, razorpayOrderId]
        )
    } catch (err) {
        console.error('[DB] activateSubscription:', err.message)
    }
}
