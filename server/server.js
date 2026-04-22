import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import client from "./src/redisClient.js";
import { handelSocketConnection } from "./src/socketRoutes.js";
import authRoutes from "./src/authRoutes.js";
import 'dotenv/config'

const app = express();
app.use(express.json())

// Allow frontend origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.PUBLIC_WEBSOCKET_URL || 'http://localhost:5173')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.PUBLIC_WEBSOCKET_URL || "http://localhost:5173"
  }
});

// ── Socket.IO auth middleware ─────────────────────────────────
io.use((socket, next) => {
  const token    = socket.handshake.auth.token
  const username = socket.handshake.auth.username

  // If JWT token provided → verify it
  if (token) {
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET)
      socket.username     = user.username
      socket.email        = user.email
      socket.collegeDomain = user.collegeDomain
      return next()
    } catch {
      // Token invalid/expired — still allow with plain username in dev
      if (process.env.NODE_ENV === 'production') {
        return next(new Error('Invalid or expired token'))
      }
    }
  }

  // Fallback: plain username (dev mode / not yet verified)
  if (!username) return next(new Error("invalid username"))
  socket.username = username
  next()
})

client.connect()
  .then(() => console.log("database connected"))
  .catch(err => console.log("error connecting db", err))

io.on("connection", (socket) => {
  handelSocketConnection(io, socket)
})

// ── Routes ───────────────────────────────────────────────────
app.use('/auth', authRoutes)

// Traffic stats endpoint
app.get('/stats', async (req, res) => {
  try {
    const connectedSockets = io.engine.clientsCount
    const waitingUsers     = await client.lLen('users')
    const activePairs      = Math.floor((connectedSockets - waitingUsers) / 2)
    const shadowBanned     = await client.sCard('shadowBanned')

    res.json({
      live: {
        connected:    connectedSockets,
        waiting:      waitingUsers,
        activeCalls:  activePairs,
        shadowBanned: shadowBanned,
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

httpServer.listen(process.env.PORT, () => console.log("port running at", process.env.PORT))
