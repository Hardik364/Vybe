import { Router } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { OAuth2Client } from 'google-auth-library'
import client from './redisClient.js'
import { sendOtpEmail } from './utils/emailService.js'
import { upsertUser, setAbcStatus, setUserTier } from './db.js'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const { patterns, known } = JSON.parse(
    readFileSync(join(__dirname, 'data/collegeDomains.json'), 'utf8')
)

const VALID_GENDERS = new Set(['male', 'female', 'transgender', 'unspecified'])

// ── Helpers ──────────────────────────────────────────────────

// Cryptographically secure OTP — Math.random() is NOT safe
function generateOtp() {
    return crypto.randomInt(100000, 1000000).toString()
}

// Returns the college domain if the email belongs to a known college,
// otherwise 'global'. Used to scope matching queues — open to all,
// but college students still get their college-scoped experience.
function getCollegeDomain(email) {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return 'global'
    if (known.includes(domain)) return domain
    const parts = domain.split('.')
    if (parts.length >= 3 && patterns.some(p => domain.endsWith(p))) return domain
    return 'global'
}

// ── POST /auth/send-otp ───────────────────────────────────────
// Body: { email, username?, gender?, state? }
// Open to all email addresses — not restricted to college domains.
// For returning users, username and gender are optional (already stored).
router.post('/send-otp', async (req, res) => {
    try {
        const { email, username, gender, state } = req.body
        if (!email) {
            return res.status(400).json({ error: 'Email is required' })
        }

        const emailLower = email.toLowerCase().trim()
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(emailLower)) {
            return res.status(400).json({ error: 'Invalid email address' })
        }

        // Check if this is a returning user (username already pinned to email)
        const savedUsername = await client.get(`user:username:${emailLower}`)
        const isReturning   = !!savedUsername
        const resolvedName  = savedUsername || username

        // New users must supply a username
        if (!isReturning && !username?.trim()) {
            return res.status(400).json({ error: 'Username is required for new accounts' })
        }

        // Rate limit: max 3 OTPs per email per 10 minutes
        const attempts = await client.get(`otp-attempts:${emailLower}`)
        if (attempts && parseInt(attempts) >= 3) {
            return res.status(429).json({ error: 'Too many attempts. Try again in 10 minutes.' })
        }

        const otp = generateOtp()

        // Validate and store gender (new signups only)
        const resolvedGender = VALID_GENDERS.has(gender) ? gender : 'unspecified'

        // Store OTP with resolved username, gender (and state for new signups)
        await client.setEx(`otp:${emailLower}`, 600, JSON.stringify({
            otp,
            username: resolvedName,
            gender:   resolvedGender,
            state:    state || null,
        }))

        // Increment attempt counter (expires in 10min)
        await client.incr(`otp-attempts:${emailLower}`)
        await client.expire(`otp-attempts:${emailLower}`, 600)

        // Dev: log OTP to console instead of sending email
        if (process.env.NODE_ENV !== 'production') {
            console.log(`\n[DEV] OTP for ${emailLower}: ${otp}\n`)
        } else {
            await sendOtpEmail(emailLower, otp, resolvedName)
        }

        res.json({
            success:     true,
            message:     'OTP sent to your email',
            isReturning,
            username:    isReturning ? savedUsername : undefined,
        })

    } catch (err) {
        console.error('[send-otp]', err)
        res.status(500).json({ error: 'Failed to send OTP. Check email configuration.' })
    }
})

// ── POST /auth/verify-otp ─────────────────────────────────────
// Body: { email, otp }
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required' })
        }

        const emailLower = email.toLowerCase().trim()

        // ── Per-email verify attempt rate limit ───────────────
        // Max 5 attempts before OTP is invalidated (prevents brute-force of 6-digit codes)
        const verifyAttempts = await client.incr(`otp-verify-attempts:${emailLower}`)
        await client.expire(`otp-verify-attempts:${emailLower}`, 600)
        if (verifyAttempts > 5) {
            await client.del(`otp:${emailLower}`)   // invalidate OTP — force re-request
            await client.del(`otp-verify-attempts:${emailLower}`)
            return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' })
        }

        const stored = await client.get(`otp:${emailLower}`)

        if (!stored) {
            return res.status(400).json({ error: 'OTP expired or not found. Request a new one.' })
        }

        const { otp: correctOtp, username, gender: otpGender, state } = JSON.parse(stored)

        if (otp.trim() !== correctOtp) {
            return res.status(400).json({ error: 'Incorrect OTP. Try again.' })
        }

        // OTP verified — delete it + attempt counters so they can't be reused
        await client.del(`otp:${emailLower}`)
        await client.del(`otp-attempts:${emailLower}`)
        await client.del(`otp-verify-attempts:${emailLower}`)

        // ── Pin username to email (first login wins) ──────────
        // If this email already has a saved username, use that one.
        // This prevents the same person from getting a different username
        // on every login and being matched with themselves.
        const collegeDomain   = getCollegeDomain(emailLower)
        const savedUsername   = await client.get(`user:username:${emailLower}`)
        const finalUsername   = savedUsername || username

        if (!savedUsername) {
            // First time this email has verified — lock in the username
            await client.set(`user:username:${emailLower}`, username)
        }

        // ── Persist gender (first signup only — can only be changed via update-gender) ──
        const savedGender = await client.get(`user:gender:${emailLower}`)
        const finalGender = savedGender || otpGender || 'unspecified'
        if (!savedGender && otpGender) {
            await client.set(`user:gender:${emailLower}`, otpGender)
        }

        // ── Cache state in Redis so socket layer can find it fast ────────────
        // state only comes from new signups; returning users already have it cached
        if (state) {
            await client.set(`user:state:${emailLower}`, state)
        }

        // ── Persist to Supabase (non-blocking — don't fail auth if DB is down) ──
        upsertUser({ email: emailLower, username: finalUsername, collegeDomain, state, gender: finalGender })
            .catch(err => console.error('[Auth] Supabase upsertUser failed:', err.message))

        // Issue JWT (valid for 7 days)
        const token = jwt.sign(
            { email: emailLower, username: finalUsername, collegeDomain },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )

        console.log(`[Auth] Verified: ${finalUsername} (${emailLower})${savedUsername ? ' [returning user]' : ' [new user]'}`)
        res.json({ success: true, token, username: finalUsername, collegeDomain })

    } catch (err) {
        console.error('[verify-otp]', err)
        res.status(500).json({ error: 'Verification failed.' })
    }
})

// ── GET /auth/me ──────────────────────────────────────────────
router.get('/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'No token' })

    try {
        const user   = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
        const [tier, gender, genderChanged] = await Promise.all([
            client.get(`tier:${user.email}`),
            client.get(`user:gender:${user.email}`),
            client.get(`user:gender-changed:${user.email}`),
        ])
        res.json({
            valid:          true,
            username:       user.username,
            email:          user.email,
            collegeDomain:  user.collegeDomain,
            tier:           tier || 'free',
            gender:         gender || 'unspecified',
            genderChanged:  !!genderChanged,
        })
    } catch {
        res.status(401).json({ valid: false, error: 'Token expired or invalid' })
    }
})

// ── POST /auth/update-gender ──────────────────────────────────
// One-time gender update after signup. Guarded by a Redis flag so it
// can only be used once — the flag is permanent (no TTL).
router.post('/update-gender', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Login required' })

    let user
    try { user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }) }
    catch { return res.status(401).json({ error: 'Token invalid' }) }

    const { gender } = req.body
    if (!VALID_GENDERS.has(gender)) {
        return res.status(400).json({ error: 'Invalid gender value' })
    }

    const emailLower = user.email.toLowerCase()

    const alreadyChanged = await client.get(`user:gender-changed:${emailLower}`)
    if (alreadyChanged) {
        return res.status(403).json({ error: 'Gender can only be changed once after signup.' })
    }

    await Promise.all([
        client.set(`user:gender:${emailLower}`, gender),
        client.set(`user:gender-changed:${emailLower}`, '1'),
    ])

    console.log(`[Auth] Gender updated: ${emailLower} → ${gender}`)
    res.json({ success: true, gender })
})

// ── Google OAuth2 client (lazy — only created if GOOGLE_CLIENT_ID is set) ──
const googleOAuthClient = process.env.GOOGLE_CLIENT_ID
    ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
    : null

// ── POST /auth/google ─────────────────────────────────────────
// Step 1: verify a Google `credential` (id_token).
// • Returning user → issue app JWT immediately.
// • New user       → return a short-lived nonce; client collects gender then calls /google/complete.
router.post('/google', async (req, res) => {
    if (!googleOAuthClient) {
        return res.status(501).json({ error: 'Google Sign-In is not configured on this server.' })
    }

    const { credential } = req.body
    if (!credential) return res.status(400).json({ error: 'Google credential required' })

    try {
        const ticket  = await googleOAuthClient.verifyIdToken({
            idToken:  credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        })
        const payload = ticket.getPayload()
        const { email, name, picture } = payload

        if (!email) return res.status(400).json({ error: 'No email returned from Google' })

        const emailLower     = email.toLowerCase().trim()
        const savedUsername  = await client.get(`user:username:${emailLower}`)

        if (savedUsername) {
            // ── Returning user ──────────────────────────────────────
            const collegeDomain = getCollegeDomain(emailLower)
            const token = jwt.sign(
                { email: emailLower, username: savedUsername, collegeDomain },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            )
            console.log(`[Auth] Google sign-in: ${savedUsername} (${emailLower}) [returning]`)
            return res.json({ success: true, token, username: savedUsername, collegeDomain })
        }

        // ── New user — store pending state, ask for gender ──────────
        const nonce = crypto.randomBytes(20).toString('hex')
        await client.setEx(`pending-google:${nonce}`, 300, JSON.stringify({
            email:       emailLower,
            displayName: name || emailLower.split('@')[0],
            picture:     picture || null,
        }))

        console.log(`[Auth] Google new user: ${emailLower} — awaiting gender`)
        return res.json({
            success:     true,
            isNew:       true,
            nonce,
            displayName: name || emailLower.split('@')[0],
        })
    } catch (err) {
        console.error('[Auth] Google verify failed:', err.message)
        return res.status(401).json({ error: 'Invalid or expired Google credential. Please try again.' })
    }
})

// ── POST /auth/google/complete ────────────────────────────────
// Step 2 (new users only): receive nonce + gender + optional username → create account, issue JWT.
router.post('/google/complete', async (req, res) => {
    const { nonce, gender, username: reqUsername } = req.body

    if (!nonce) return res.status(400).json({ error: 'Session nonce required' })
    if (!VALID_GENDERS.has(gender)) return res.status(400).json({ error: 'Please select a valid gender' })

    const stored = await client.get(`pending-google:${nonce}`)
    if (!stored) {
        return res.status(400).json({ error: 'Session expired — please sign in with Google again.' })
    }

    const { email: emailLower, displayName } = JSON.parse(stored)

    // Trim + sanitise username (fall back to Google display name)
    const rawName       = (reqUsername || displayName || '').trim().replace(/<[^>]*>/g, '').slice(0, 24)
    const finalUsername = rawName || `User${crypto.randomBytes(3).toString('hex')}`

    // Race-condition guard: if account was somehow created in another tab
    const existingUsername = await client.get(`user:username:${emailLower}`)
    if (existingUsername) {
        await client.del(`pending-google:${nonce}`)
        const collegeDomain = getCollegeDomain(emailLower)
        const token = jwt.sign(
            { email: emailLower, username: existingUsername, collegeDomain },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )
        return res.json({ success: true, token, username: existingUsername, collegeDomain })
    }

    const collegeDomain = getCollegeDomain(emailLower)

    await Promise.all([
        client.set(`user:username:${emailLower}`, finalUsername),
        client.set(`user:gender:${emailLower}`, gender),
        client.del(`pending-google:${nonce}`),
    ])

    // Persist to Supabase (non-blocking)
    upsertUser({ email: emailLower, username: finalUsername, collegeDomain, gender })
        .catch(err => console.error('[Auth] Google upsertUser failed:', err.message))

    const token = jwt.sign(
        { email: emailLower, username: finalUsername, collegeDomain },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    )

    console.log(`[Auth] Google sign-in complete: ${finalUsername} (${emailLower}) [new]`)
    res.json({ success: true, token, username: finalUsername, collegeDomain })
})

// ── POST /auth/verify-abc ─────────────────────────────────────
// Validates ABC (Academic Bank of Credits) ID — 12-digit number.
// In development: stores as 'pending' (no real API call).
// In production: wire up to DigiLocker / NATS API for real verification.
router.post('/verify-abc', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Login required' })

    let user
    try { user = jwt.verify(token, process.env.JWT_SECRET) }
    catch { return res.status(401).json({ error: 'Token invalid' }) }

    const { abcId } = req.body
    if (!abcId) return res.status(400).json({ error: 'ABC ID required' })

    // Basic format validation — 12 digits
    const cleaned = abcId.replace(/\s/g, '')
    if (!/^\d{12}$/.test(cleaned)) {
        return res.status(400).json({ error: 'ABC ID must be a 12-digit number' })
    }

    try {
        const existing = await client.get(`abc:${user.email}`)
        if (existing === 'verified') {
            return res.json({ status: 'verified', message: 'Already verified' })
        }

        // TODO: wire to real ABC / DigiLocker API in production
        //   const result = await verifyWithDigiLocker(cleaned, user.email)
        //   if (!result.valid) return res.status(400).json({ error: result.reason })
        //   if (result.age < 18) return res.status(403).json({ error: 'Must be 18+ to use UniBuddy' })

        // Store ABC ID hash (never store raw) + pending status
        const hash = crypto.createHash('sha256').update(cleaned).digest('hex')
        await client.set(`abc:${user.email}`, 'pending')
        await client.set(`abc-hash:${user.email}`, hash)

        console.log(`[ABC] Submitted for ${user.email} — pending verification`)
        res.json({ status: 'pending', message: 'Verification submitted. Approved within 24h.' })
    } catch (err) {
        console.error('[verify-abc]', err)
        res.status(500).json({ error: 'Verification failed. Please try again.' })
    }
})

// ── GET /auth/abc-status ──────────────────────────────────────
router.get('/abc-status', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Login required' })

    try {
        const user   = jwt.verify(token, process.env.JWT_SECRET)
        const status = await client.get(`abc:${user.email}`) || 'none'
        res.json({ status })  // 'none' | 'pending' | 'verified'
    } catch {
        res.status(401).json({ error: 'Token invalid' })
    }
})

// ── POST /auth/set-tier ────────────────────────────────────────
// Internal endpoint — called by Razorpay webhook when payment confirmed
// Protected by a shared webhook secret (not JWT)
router.post('/set-tier', async (req, res) => {
    const { email, tier, secret } = req.body
    if (secret !== process.env.WEBHOOK_SECRET) {
        return res.status(403).json({ error: 'Forbidden' })
    }
    if (!['free', 'plus', 'pro'].includes(tier)) {
        return res.status(400).json({ error: 'Invalid tier' })
    }
    // Validate email format before using it as a Redis key
    const emailLower = (email || '').toLowerCase().trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailLower)) {
        return res.status(400).json({ error: 'Invalid email' })
    }
    try {
        if (tier === 'free') {
            await client.del(`tier:${emailLower}`)
        } else {
            // 30-day TTL — subscription expires automatically
            await client.setEx(`tier:${emailLower}`, 30 * 24 * 60 * 60, tier)
        }
        console.log(`[Tier] ${emailLower} → ${tier}`)
        res.json({ success: true })
    } catch (err) {
        console.error('[set-tier]', err)
        res.status(500).json({ error: 'Failed to update tier.' })
    }
})

// ── POST /auth/guest ──────────────────────────────────────────
// Guest login: creates a temporary token for one free call
router.post('/guest', async (req, res) => {
    try {
        const deviceId = req.body?.deviceId || crypto.randomBytes(16).toString('hex')
        const guestIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip
        const guestKey = `guest:${guestIp}`

        // Check if this IP has already used their free guest call
        const guestUsed = await client.get(guestKey)
        if (guestUsed) {
            return res.status(429).json({ error: 'Guest limit reached. Please sign up.' })
        }

        // Mark this IP as having used their guest call (expires in 24h)
        await client.setEx(guestKey, 24 * 60 * 60, '1')

        // Generate a guest token (valid for 24 hours)
        const token = jwt.sign(
            { username: `Guest${Math.random().toString(36).substr(2, 5).toUpperCase()}`, isGuest: true, deviceId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        )

        console.log(`[Guest] New guest session from ${guestIp}`)
        res.json({ success: true, token, username: 'Guest' })

    } catch (err) {
        console.error('[guest]', err)
        res.status(500).json({ error: 'Failed to create guest session.' })
    }
})

export default router
