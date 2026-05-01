import { createClient } from 'redis'
import 'dotenv/config'

// Upstash and most managed Redis providers require TLS.
// Set REDIS_TLS=true in production .env to enable it.
const client = createClient({
    ...(process.env.REDIS_PWD ? { password: process.env.REDIS_PWD } : {}),
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        tls:  process.env.REDIS_TLS === 'true',   // set REDIS_TLS=true on Upstash
        // Reconnect on drops — important for long-running production servers
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error('[Redis] Too many reconnect attempts — giving up')
                return new Error('Redis reconnect limit reached')
            }
            return Math.min(retries * 200, 3000)  // exponential backoff, max 3s
        },
    },
})

client.on('error',       err  => console.error('[Redis] Error:', err.message))
client.on('reconnecting', ()  => console.log('[Redis] Reconnecting…'))
client.on('ready',        ()  => console.log('[Redis] Ready'))

export default client
