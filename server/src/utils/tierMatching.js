import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const cityMap    = JSON.parse(readFileSync(join(__dirname, '../data/cityMap.json'), 'utf8'))

// Build reverse map: domain → city
const domainToCity = {}
for (const [city, domains] of Object.entries(cityMap)) {
    for (const domain of domains) {
        domainToCity[domain] = city
    }
}

export function getCityForDomain(domain) {
    return domainToCity[domain] || null
}

// Returns ordered list of queue keys to try when finding a match
// First match found wins — ensures tighter matches are preferred
export function getMatchQueues(socket) {
    const domain = socket.collegeDomain || 'global'
    const tier   = socket.tier          || 'free'
    const shadow = socket.shadowBanned

    const prefix = shadow ? 'users:shadow' : 'users'

    if (tier === 'free') {
        // Only match within own college
        return [`${prefix}:${domain}`]
    }

    if (tier === 'plus') {
        // Try own college first, then rest of city
        const city = getCityForDomain(domain)
        const queues = [`${prefix}:${domain}`]
        if (city) {
            const cityDomains = cityMap[city] || []
            for (const d of cityDomains) {
                if (d !== domain) queues.push(`${prefix}:${d}`)
            }
        }
        return queues
    }

    if (tier === 'pro') {
        // Try own college → city → global
        const city = getCityForDomain(domain)
        const queues = [`${prefix}:${domain}`]
        if (city) {
            const cityDomains = cityMap[city] || []
            for (const d of cityDomains) {
                if (d !== domain) queues.push(`${prefix}:${d}`)
            }
        }
        queues.push(`${prefix}:global`)
        return queues
    }

    return [`${prefix}:${domain}`]
}

// Returns the self-registration queue key (where this user waits)
export function getSelfQueue(socket) {
    const domain = socket.collegeDomain || 'global'
    const shadow = socket.shadowBanned
    const prefix = shadow ? 'users:shadow' : 'users'
    return `${prefix}:${domain}`
}

export const TIERS = {
    free: {
        id:       'free',
        name:     'Free',
        price:    '₹0',
        period:   'forever',
        scope:    'Your college only',
        color:    '#A0A0A0',
        features: [
            'Match with your college',
            'Voice + text chat',
            'Conversation prompts',
            'Karma system',
        ],
        cta:      'Current Plan',
    },
    plus: {
        id:       'plus',
        name:     'Plus',
        price:    '₹49',
        period:   '/month',
        scope:    'Same city colleges',
        color:    '#6C63FF',
        features: [
            'Everything in Free',
            'Match across your city',
            'Priority matching',
            'Day Pass available (₹19)',
        ],
        cta:      'Coming Soon',
    },
    pro: {
        id:       'pro',
        name:     'Pro',
        price:    '₹99',
        period:   '/month',
        scope:    'Any college globally',
        color:    '#F59E0B',
        features: [
            'Everything in Plus',
            'Match any college worldwide',
            'Week Pass available (₹49)',
            'Early access to new features',
        ],
        cta:      'Coming Soon',
    },
}
