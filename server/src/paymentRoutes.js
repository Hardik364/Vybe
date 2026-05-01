// paymentRoutes.js — Razorpay integration for RealTalk
// Endpoints:
//   POST /payments/create-order   — create a Razorpay order
//   POST /payments/verify         — verify payment signature, activate tier
//   POST /payments/webhook        — Razorpay webhook (backup activation)
//   GET  /payments/status         — return current tier + expiry for logged-in user

import { Router }      from 'express'
import Razorpay        from 'razorpay'
import crypto          from 'crypto'
import jwt             from 'jsonwebtoken'
import client          from './redisClient.js'

const router = Router()

// ── Razorpay client — lazy init ────────────────────────────────
// Razorpay throws at construction if keys are empty, so we init on-demand.
// Set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in server/.env
// Get them at: https://dashboard.razorpay.com/app/keys
let _rzp = null
function getRzp() {
    if (!process.env.RAZORPAY_KEY_ID) return null
    if (!_rzp) {
        _rzp = new Razorpay({
            key_id:     process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        })
    }
    return _rzp
}

// ── Plan catalogue ─────────────────────────────────────────────
const PLANS = {
    'day-pass':     { name: 'Day Pass',      tier: 'plus', amountPaise: 1900,  ttlSeconds: 86400        },
    'week-pass':    { name: 'Week Pass',      tier: 'pro',  amountPaise: 4900,  ttlSeconds: 7 * 86400    },
    'plus-monthly': { name: 'Plus Monthly',   tier: 'plus', amountPaise: 4900,  ttlSeconds: 30 * 86400   },
    'pro-monthly':  { name: 'Pro Monthly',    tier: 'pro',  amountPaise: 9900,  ttlSeconds: 30 * 86400   },
}

// ── Auth middleware — extract email from JWT ───────────────────
function requireAuth(req, res, next) {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
    try {
        req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
        next()
    } catch {
        return res.status(401).json({ error: 'Token expired or invalid' })
    }
}

// ── POST /payments/create-order ────────────────────────────────
router.post('/create-order', requireAuth, async (req, res) => {
    try {
        const { planId } = req.body
        const plan = PLANS[planId]
        if (!plan) return res.status(400).json({ error: 'Invalid plan' })

        const rzp = getRzp()
        if (!rzp) {
            return res.status(503).json({ error: 'Payments not configured yet. Coming soon!' })
        }

        const order = await rzp.orders.create({
            amount:   plan.amountPaise,
            currency: 'INR',
            receipt:  `rt_${Date.now()}`,
            notes:    { email: req.user.email, planId },
        })

        res.json({
            orderId:  order.id,
            amount:   order.amount,
            currency: order.currency,
            planName: plan.name,
            keyId:    process.env.RAZORPAY_KEY_ID,
        })
    } catch (err) {
        console.error('[Payment] create-order error:', err)
        res.status(500).json({ error: err.message })
    }
})

// ── POST /payments/verify ──────────────────────────────────────
// Called client-side after Razorpay checkout completes
router.post('/verify', requireAuth, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Missing payment fields' })
        }

        // Verify HMAC signature
        const expected = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex')

        if (expected !== razorpay_signature) {
            console.warn('[Payment] Signature mismatch for', req.user.email)
            return res.status(400).json({ error: 'Payment verification failed' })
        }

        const plan = PLANS[planId]
        if (!plan) return res.status(400).json({ error: 'Invalid plan' })

        // Activate tier in Redis
        await activateTier(req.user.email, plan.tier, plan.ttlSeconds, {
            paymentId:   razorpay_payment_id,
            orderId:     razorpay_order_id,
            planId,
            activatedAt: Date.now(),
        })

        console.log(`[Payment] Activated ${plan.tier} for ${req.user.email} (${plan.name})`)
        res.json({ success: true, tier: plan.tier, planName: plan.name })
    } catch (err) {
        console.error('[Payment] verify error:', err)
        res.status(500).json({ error: err.message })
    }
})

// ── POST /payments/webhook ─────────────────────────────────────
// Backup server-to-server activation from Razorpay dashboard
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature']
        const body      = JSON.stringify(req.body)
        const expected  = crypto
            .createHmac('sha256', process.env.WEBHOOK_SECRET || '')
            .update(body)
            .digest('hex')

        if (signature !== expected) {
            console.warn('[Webhook] Invalid signature')
            return res.status(400).json({ error: 'Invalid signature' })
        }

        const event = req.body
        if (event.event === 'payment.captured') {
            const payment = event.payload?.payment?.entity
            const email   = payment?.notes?.email
            const planId  = payment?.notes?.planId
            const plan    = PLANS[planId]

            if (email && plan) {
                await activateTier(email, plan.tier, plan.ttlSeconds, {
                    paymentId:   payment.id,
                    planId,
                    activatedAt: Date.now(),
                    source:      'webhook',
                })
                console.log(`[Webhook] Activated ${plan.tier} for ${email} via webhook`)
            }
        }

        res.json({ received: true })
    } catch (err) {
        console.error('[Webhook] error:', err)
        res.status(500).json({ error: err.message })
    }
})

// ── GET /payments/status ───────────────────────────────────────
router.get('/status', requireAuth, async (req, res) => {
    try {
        const tier    = await client.get(`tier:${req.user.email}`)  || 'free'
        const ttl     = await client.ttl(`tier:${req.user.email}`)   // seconds remaining, -1 = no expiry
        const history = await client.lRange(`purchases:${req.user.email}`, 0, 9)

        res.json({
            tier,
            expiresIn: ttl > 0 ? ttl : null,
            expiresAt: ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null,
            history:   history.map(h => JSON.parse(h)),
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ── Shared helper: activate a tier + log purchase ──────────────
async function activateTier(email, tier, ttlSeconds, meta = {}) {
    await client.set(`tier:${email}`, tier, { EX: ttlSeconds })

    // Append to purchase history (keep last 20)
    const record = JSON.stringify({ tier, ...meta })
    await client.lPush(`purchases:${email}`, record)
    await client.lTrim(`purchases:${email}`, 0, 19)
}

export default router
