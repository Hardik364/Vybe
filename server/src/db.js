/**
 * db.js — Supabase database helpers
 *
 * All persistent user data lives here.
 * Redis is still used for ephemeral stuff (queues, sessions, rate-limits).
 */
import supabase from './supabaseClient.js'

// Guard — if Supabase not configured, operations are no-ops
function guard(label) {
    if (!supabase) {
        console.warn(`[DB] ${label} skipped — Supabase not configured`)
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
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()
    if (error && error.code !== 'PGRST116') console.error('[DB] getUser:', error.message)
    return data || null
}

/**
 * Create or update a user on first OTP verification.
 * Uses upsert so re-verification doesn't overwrite the username.
 */
export async function upsertUser({ email, username, collegeDomain, state = null, gender = null }) {
    if (guard('upsertUser')) return null

    const payload = {
        email,
        username,
        college_domain: collegeDomain,
        last_seen_at:   new Date().toISOString(),
    }
    // Only set city/state if supplied (new signups only — returning logins skip this)
    if (state)  payload.city   = state
    // Only set gender on first signup — update-gender endpoint handles changes
    if (gender) payload.gender = gender

    const { data, error } = await supabase
        .from('users')
        .upsert(payload, { onConflict: 'email', ignoreDuplicates: false })
        .select()
        .single()
    if (error) console.error('[DB] upsertUser:', error.message)
    return data || null
}

/**
 * Update user's last_seen_at timestamp (call on Socket.IO connect).
 */
export async function touchUser(email) {
    if (guard('touchUser') || !email) return
    await supabase
        .from('users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('email', email)
}

/**
 * Update ABC verification status.
 */
export async function setAbcStatus(email, status, hash = null) {
    if (guard('setAbcStatus')) return
    const update = { abc_status: status }
    if (hash) update.abc_hash = hash
    await supabase.from('users').update(update).eq('email', email)
}

/**
 * Set user tier after payment confirmed.
 * Pass expiresAt = null to reset to free.
 */
export async function setUserTier(email, tier, expiresAt = null) {
    if (guard('setUserTier')) return
    await supabase
        .from('users')
        .update({ tier, tier_expires_at: expiresAt })
        .eq('email', email)
}

/**
 * Ban or shadow-ban a user by email.
 */
export async function banUser(email, { shadowBan = false } = {}) {
    if (guard('banUser')) return
    const update = shadowBan
        ? { is_shadow_banned: true }
        : { is_banned: true }
    await supabase.from('users').update(update).eq('email', email)
}

// ── Karma ─────────────────────────────────────────────────────

/**
 * Record a karma rating and update the aggregate.
 * rating: 'great' | 'okay' | 'disrespectful'
 */
export async function recordKarma(ratedEmail, rating, raterEmail = null) {
    if (guard('recordKarma')) return
    try {
        // Log the individual event
        await supabase.from('karma_events').insert({
            rated_email: ratedEmail,
            rater_email: raterEmail,
            rating,
        })

        // Upsert aggregate row
        const { data: existing } = await supabase
            .from('karma')
            .select('*')
            .eq('email', ratedEmail)
            .single()

        if (existing) {
            await supabase
                .from('karma')
                .update({
                    [rating]: existing[rating] + 1,
                    total: existing.total + 1,
                    updated_at: new Date().toISOString(),
                })
                .eq('email', ratedEmail)
        } else {
            await supabase.from('karma').insert({
                email: ratedEmail,
                [rating]: 1,
                total: 1,
            })
        }
    } catch (err) {
        console.error('[DB] recordKarma:', err.message)
    }
}

/**
 * Get karma aggregate for an email.
 */
export async function getKarma(email) {
    if (guard('getKarma')) return { great: 0, okay: 0, disrespectful: 0, total: 0 }
    const { data } = await supabase
        .from('karma')
        .select('*')
        .eq('email', email)
        .single()
    return data || { great: 0, okay: 0, disrespectful: 0, total: 0 }
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
        await supabase.from('reports').insert({
            reported_email: reportedEmail,
            reporter_email: reporterEmail,
            reason,
        })

        // Count unique reporters
        const { count } = await supabase
            .from('reports')
            .select('reporter_email', { count: 'exact', head: true })
            .eq('reported_email', reportedEmail)
            .not('reporter_email', 'is', null)

        return count || 0
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
    const { data, error } = await supabase
        .from('subscriptions')
        .insert({
            email,
            plan,
            amount_paise: amountPaise,
            razorpay_order_id: razorpayOrderId,
            status: 'pending',
        })
        .select()
        .single()
    if (error) console.error('[DB] createSubscription:', error.message)
    return data
}

/**
 * Mark a subscription as active after payment confirmed.
 */
export async function activateSubscription(razorpayOrderId, razorpayPaymentId, expiresAt) {
    if (guard('activateSubscription')) return
    await supabase
        .from('subscriptions')
        .update({
            razorpay_payment_id: razorpayPaymentId,
            status: 'active',
            starts_at: new Date().toISOString(),
            expires_at: expiresAt,
        })
        .eq('razorpay_order_id', razorpayOrderId)
}
