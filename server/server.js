import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import client from "./src/redisClient.js";
import { handelSocketConnection } from "./src/socketRoutes.js";
import authRoutes from "./src/authRoutes.js";
import adminRoutes from "./src/adminRoutes.js";
import communityRoutes from "./src/communityRoutes.js";
import apiRoutes      from "./src/apiRoutes.js";
import paymentRoutes  from "./src/paymentRoutes.js";
import 'dotenv/config'

const app = express();

// ── Security headers ─────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,   // needed for WebRTC
  contentSecurityPolicy: false,        // handled by Vite in prod
}))

app.use(express.json({ limit: '16kb' }))  // prevent large payload attacks

// ── CORS ─────────────────────────────────────────────────────
const frontendOrigin = (process.env.PUBLIC_WEBSOCKET_URL || 'http://localhost:5173').replace(/\/$/, '')
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', frontendOrigin)
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// ── Rate limiting ─────────────────────────────────────────────
// General API: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
})

// Auth endpoints: stricter — 10 per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' }
})

app.use('/api', generalLimiter)
app.use('/auth', authLimiter)

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: frontendOrigin },
  // Limit Socket.IO payload size
  maxHttpBufferSize: 1e5,  // 100 KB
  pingTimeout: 20000,
  pingInterval: 10000,
})

// ── Socket.IO auth middleware ─────────────────────────────────
io.use((socket, next) => {
  const token    = socket.handshake.auth.token
  const username = socket.handshake.auth.username

  if (token) {
    try {
      const user           = jwt.verify(token, process.env.JWT_SECRET)
      socket.username      = user.username
      socket.email         = user.email
      socket.collegeDomain = user.collegeDomain
      return next()
    } catch {
      if (process.env.NODE_ENV === 'production') {
        return next(new Error('Invalid or expired token'))
      }
    }
  }

  if (!username) return next(new Error("invalid username"))
  socket.username = username

  // ── Guest tracking ───────────────────────────────────────────
  // isGuest flag lets socketRoutes enforce the 1-call limit server-side
  const isGuest = socket.handshake.auth.isGuest
  if (isGuest) {
    socket.isGuest  = true
    socket.deviceId = socket.handshake.auth.deviceId || null
    socket.guestIp  = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim()
                      || socket.handshake.address
  }

  next()
})

// ── Redis connection ──────────────────────────────────────────
client.connect()
  .then(() => console.log("✅ Redis connected"))
  .catch(err => {
    console.error("❌ Redis connection failed:", err)
    process.exit(1)
  })

// ── Socket.IO ────────────────────────────────────────────────
io.on("connection", (socket) => {
  handelSocketConnection(io, socket)
})

// ── Routes ───────────────────────────────────────────────────
app.use('/auth', authRoutes)
app.locals.io = io          // give admin routes access to io
app.use('/admin', adminRoutes)
app.use('/community', communityRoutes)
app.use('/api', apiRoutes)
app.use('/payments', paymentRoutes)

// ── Health check (Render pings this to check if service is up) ──
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }))

// Stats — protect with a simple token in production
app.get('/stats', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    const key = req.headers['x-stats-key']
    if (key !== process.env.STATS_KEY) return res.status(403).json({ error: 'Forbidden' })
  }
  try {
    const connectedSockets = io.engine.clientsCount
    const shadowBanned     = await client.sCard('shadowBanned')
    const suspended        = await client.sCard('suspended')
    const bannedEmails     = await client.sCard('banned:emails')

    res.json({
      live: {
        connected:    connectedSockets,
        shadowBanned,
        suspended,
        bannedEmails,
      },
      server: {
        uptime:  `${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s`,
        memory:  `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
        nodeEnv: process.env.NODE_ENV || 'development',
      },
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }))

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Express Error]', err)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`))

// ── Graceful shutdown ─────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`)
  httpServer.close(async () => {
    await client.quit()
    console.log('✅ Clean shutdown complete')
    process.exit(0)
  })
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
