// tierMatching.js — controls which Redis queues are searched per tier
//
// Free:  only own university queue             users:{domain}
// Plus:  own uni → all unis in same state
// Pro:   own uni → same state → global pool
//
// Shadow-banned users get separate prefix so they only match each other.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const stateMap   = JSON.parse(readFileSync(join(__dirname, '../data/stateMap.json'), 'utf8'))

// Build reverse map: domain → state name
const domainToState = {}
for (const [state, domains] of Object.entries(stateMap)) {
    for (const domain of domains) {
        domainToState[domain] = state
    }
}

export function getStateForDomain(domain) {
    return domainToState[domain] || null
}

// Returns ordered list of queue keys to try when finding a match.
// First match found wins — tighter scopes are always tried first.
export function getMatchQueues(socket) {
    const domain = socket.collegeDomain || 'global'
    const tier   = socket.tier          || 'free'
    const shadow = socket.shadowBanned
    const prefix = shadow ? 'users:shadow' : 'users'

    if (tier === 'free') {
        // Free: only own university
        return [`${prefix}:${domain}`]
    }

    if (tier === 'plus') {
        // Plus: own uni first, then all other unis in the same state
        const state  = getStateForDomain(domain)
        const queues = [`${prefix}:${domain}`]
        if (state) {
            const stateDomains = stateMap[state] || []
            for (const d of stateDomains) {
                if (d !== domain) queues.push(`${prefix}:${d}`)
            }
        }
        return queues
    }

    if (tier === 'pro') {
        // Pro: own uni → same state → global pool
        const state  = getStateForDomain(domain)
        const queues = [`${prefix}:${domain}`]
        if (state) {
            const stateDomains = stateMap[state] || []
            for (const d of stateDomains) {
                if (d !== domain) queues.push(`${prefix}:${d}`)
            }
        }
        queues.push(`${prefix}:global`)
        return queues
    }

    return [`${prefix}:${domain}`]
}

// Where this socket registers itself to wait
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
        scope:    'Your university only',
        color:    '#A0A0A0',
        features: [
            'Match within your university',
            'Voice + video chat',
            'Conversation prompts on match',
            'Karma protection system',
        ],
        cta: 'Current Plan',
    },
    plus: {
        id:       'plus',
        name:     'Plus',
        price:    '₹49',
        period:   '/month',
        scope:    'Same state universities',
        color:    '#6C63FF',
        features: [
            'Everything in Free',
            'Match across your state',
            'Priority matching queue',
            'Day Pass available (₹19)',
        ],
        cta: 'Upgrade',
    },
    pro: {
        id:       'pro',
        name:     'Pro',
        price:    '₹99',
        period:   '/month',
        scope:    'Any university in India & globally',
        color:    '#F59E0B',
        features: [
            'Everything in Plus',
            'Match any university worldwide',
            'Week Pass available (₹49)',
            'Early access to new features',
        ],
        cta: 'Upgrade',
    },
}
