'use client'
import { useState } from 'react'
import CheckoutModal from './CheckoutModal'

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    per: '',
    scope: 'Your college only',
    color: 'oklch(55% 0.01 265)',
    features: ['Match with your own college', 'Voice + optional video', 'Conversation prompts', 'Community chat'],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '₹49',
    per: '/month',
    scope: 'Same state colleges',
    color: 'var(--accent)',
    badge: '✨ Popular',
    features: ['Everything in Free', 'Match same-state colleges', 'Priority in queue', 'Conversation insights'],
    plans: [
      { id: 'plus-monthly', label: '₹49 / month' },
      { id: 'day-pass',     label: '₹19 day pass' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹99',
    per: '/month',
    scope: 'Any college globally',
    color: 'var(--amber)',
    features: ['Everything in Plus', 'Match any college worldwide', 'Early access to features', 'Priority support'],
    plans: [
      { id: 'pro-monthly', label: '₹99 / month' },
      { id: 'week-pass',   label: '₹49 week pass' },
    ],
  },
]

export default function UpgradeModal({ currentTier, onClose, onTierChange }) {
  const [selectedPlan, setSelectedPlan] = useState(null)

  if (selectedPlan) {
    return (
      <div className="up-overlay">
        <CheckoutModal
          selectedPlan={selectedPlan}
          onSuccess={tier => { onTierChange(tier); setSelectedPlan(null) }}
          onClose={() => setSelectedPlan(null)}
        />
      </div>
    )
  }

  return (
    <div className="up-overlay">
      <div className="up-modal">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28, position: 'relative' }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: -4, right: -4,
              width: 32, height: 32, borderRadius: 'var(--r-full)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--t3)', fontSize: 15, background: 'none', border: 'none',
              cursor: 'pointer', transition: 'all var(--t-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elev)'; e.currentTarget.style.color = 'var(--t1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '' }}
          >
            ✕
          </button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, color: 'var(--t1)', marginBottom: 6 }}>
            ⚡ Upgrade UniBuddy
          </h2>
          <p style={{ fontSize: 14, color: 'var(--t3)' }}>Unlock more conversations. Connect further.</p>
        </div>

        {/* Tier cards */}
        <div className="up-tiers">
          {TIERS.map(tier => {
            const isCurr = currentTier === tier.id
            const isFeat = tier.id === 'plus'
            return (
              <div
                key={tier.id}
                className="tier-card"
                style={{
                  border: isCurr
                    ? '1.5px solid var(--green)'
                    : isFeat
                    ? '1.5px solid var(--accent)'
                    : '1.5px solid var(--border)',
                  boxShadow: isFeat ? '0 0 0 1px var(--accent-glow)' : undefined,
                }}
              >
                {/* Badge */}
                {tier.badge && (
                  <span style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 11, fontWeight: 900, padding: '3px 12px',
                    borderRadius: 'var(--r-full)', background: 'var(--accent)',
                    color: '#fff', whiteSpace: 'nowrap',
                  }}>
                    {tier.badge}
                  </span>
                )}
                {isCurr && (
                  <span style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 11, fontWeight: 900, padding: '3px 12px',
                    borderRadius: 'var(--r-full)', background: 'var(--green)',
                    color: '#fff', whiteSpace: 'nowrap',
                  }}>
                    ✓ Current
                  </span>
                )}

                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 900, color: tier.color }}>
                  {tier.name}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--t3)', fontWeight: 500 }}>{tier.scope}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900, color: 'var(--t1)' }}>{tier.price}</span>
                  <span style={{ fontSize: 13, color: 'var(--t3)' }}>{tier.per}</span>
                </div>

                <ul style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, listStyle: 'none' }}>
                  {tier.features.map((f, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--t2)', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                      <span style={{ color: 'var(--green)', fontWeight: 900, flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurr ? (
                  <button
                    disabled
                    style={{
                      marginTop: 6, width: '100%', padding: '11px 0',
                      borderRadius: 'var(--r-md)', fontSize: 14, fontWeight: 700,
                      border: 'none', cursor: 'default',
                      background: 'var(--green-sub)', color: 'var(--green)',
                    }}
                  >
                    ✓ Active Plan
                  </button>
                ) : tier.id === 'free' ? (
                  <button
                    disabled
                    style={{
                      marginTop: 6, width: '100%', padding: '11px 0',
                      borderRadius: 'var(--r-md)', fontSize: 14, fontWeight: 700,
                      border: 'none', cursor: 'default',
                      background: 'var(--bg-float)', color: 'var(--t3)',
                    }}
                  >
                    Free Forever
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    {tier.plans.map(plan => (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan.id)}
                        style={{
                          width: '100%', padding: '9px 0',
                          borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 700,
                          border: '1px solid var(--border)', color: 'var(--t2)',
                          background: 'var(--bg-float)', cursor: 'pointer',
                          transition: 'all var(--t-fast)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--sh-sm)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
                      >
                        {plan.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--t4)', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          🔒 Secured by Razorpay · UPI, Cards, NetBanking accepted · Cancel anytime
        </p>
      </div>
    </div>
  )
}
