import { Router } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import client from './redisClient.js'
import { sendOtpEmail } from './utils/emailService.js'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const { patterns, known } = JSON.parse(
    readFileSync(join(__dirname, 'data/collegeDomains.json'), 'utf8')
)

// ── Helpers ──────────────────────────────────────────────────

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

function isCollegeEmail(email) {
    // In development mode accept any email for testing
    if (process.env.NODE_ENV !== 'production') return true

    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return false

    // Check exact known domains
    if (known.includes(domain)) return true

    // Check suffix patterns (.ac.in, .edu.in, .edu)
    return patterns.some(p => domain.endsWith(p))
}

// ── POST /auth/send-otp ───────────────────────────────────────
// Body: { email, username? }
// For returning users, username is optional — we look it up from Redis.
router.post('/send-otp', async (req, res) => {
    try {
        const { email, username } = req.body
        if (!email) {
            return res.status(400).json({ error: 'Email is required' })
        }

        const emailLower = email.toLowerCase().trim()
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(emailLower)) {
            return res.status(400).json({ error: 'Invalid email address' })
        }

        if (!isCollegeEmail(emailLower)) {
            return res.status(400).json({
                error: 'Please use your college email (.ac.in, .edu, etc.)'
            })
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

        // Store OTP with resolved username
        await client.setEx(`otp:${emailLower}`, 600, JSON.stringify({ otp, username: resolvedName }))

        // Increment attempt counter (expires in 10min)
        await client.incr(`otp-attempts:${emailLower}`)
        await client.expire(`otp-attempts:${emailLower}`, 600)

        // Send email
        await sendOtpEmail(emailLower, otp, resolvedName)

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
        const stored = await client.get(`otp:${emailLower}`)

        if (!stored) {
            return res.status(400).json({ error: 'OTP expired or not found. Request a new one.' })
        }

        const { otp: correctOtp, username } = JSON.parse(stored)

        if (otp.trim() !== correctOtp) {
            return res.status(400).json({ error: 'Incorrect OTP. Try again.' })
        }

        // OTP verified — delete it so it can't be reused
        await client.del(`otp:${emailLower}`)
        await client.del(`otp-attempts:${emailLower}`)

        // ── Pin username to email (first login wins) ──────────
        // If this email already has a saved username, use that one.
        // This prevents the same person from getting a different username
        // on every login and being matched with themselves.
        const collegeDomain   = emailLower.split('@')[1]
        const savedUsername   = await client.get(`user:username:${emailLower}`)
        const finalUsername   = savedUsername || username

        if (!savedUsername) {
            // First time this email has verified — lock in the username
            await client.set(`user:username:${emailLower}`, username)
        }

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
        const user  = jwt.verify(token, process.env.JWT_SECRET)
        const tier  = await client.get(`tier:${user.email}`) || 'free'
        res.json({ valid: true, username: user.username, email: user.email, collegeDomain: user.collegeDomain, tier })
    } catch {
        res.status(401).json({ valid: false, error: 'Token expired or invalid' })
    }
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
        res.status(500).json({ error: err.message })
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
    try {
        if (tier === 'free') {
            await client.del(`tier:${email}`)
        } else {
            // 30-day TTL — subscription expires automatically
            await client.setEx(`tier:${email}`, 30 * 24 * 60 * 60, tier)
        }
        console.log(`[Tier] ${email} → ${tier}`)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
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
