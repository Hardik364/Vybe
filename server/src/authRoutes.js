import { Router } from 'express'
import jwt from 'jsonwebtoken'
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
// Body: { email, username }
router.post('/send-otp', async (req, res) => {
    try {
        const { email, username } = req.body
        if (!email || !username) {
            return res.status(400).json({ error: 'Email and username are required' })
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

        // Rate limit: max 3 OTPs per email per 10 minutes
        const attempts = await client.get(`otp-attempts:${emailLower}`)
        if (attempts && parseInt(attempts) >= 3) {
            return res.status(429).json({ error: 'Too many attempts. Try again in 10 minutes.' })
        }

        const otp = generateOtp()

        // Store OTP in Redis with 10min TTL
        await client.setEx(`otp:${emailLower}`, 600, JSON.stringify({ otp, username }))

        // Increment attempt counter (expires in 10min)
        await client.incr(`otp-attempts:${emailLower}`)
        await client.expire(`otp-attempts:${emailLower}`, 600)

        // Send email
        await sendOtpEmail(emailLower, otp, username)

        res.json({ success: true, message: 'OTP sent to your email' })

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

        // Issue JWT (valid for 7 days)
        const collegeDomain = emailLower.split('@')[1]
        const token = jwt.sign(
            { email: emailLower, username, collegeDomain },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )

        console.log(`[Auth] Verified: ${username} (${emailLower})`)
        res.json({ success: true, token, username, collegeDomain })

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

export default router
