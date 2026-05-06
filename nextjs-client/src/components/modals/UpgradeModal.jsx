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
    cta: 'Current Plan',
    ctaClass: 'active',
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
      <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 animate-fade-in" style={{ background: 'var(--bg-over)', backdropFilter: 'blur(12px)' }}>
        <CheckoutModal
          selectedPlan={selectedPlan}
          onSuccess={tier => { onTierChange(tier); setSelectedPlan(null) }}
          onClose={() => setSelectedPlan(null)}
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 animate-fade-in" style={{ background: 'var(--bg-over)', backdropFilter: 'blur(12px)' }}>
      <div className="bg-surf border border-bdr rounded-xl p-9 w-full max-w-[840px] max-h-[90vh] overflow-y-auto shadow-lg animate-pop-in relative">
        {/* Header */}
        <div className="text-center mb-7 relative">
          <button onClick={onClose} className="absolute top-[-4px] right-[-4px] w-8 h-8 rounded-2xl flex items-center justify-center text-t3 text-[15px] transition-all hover:bg-elev hover:text-t1">✕</button>
          <h2 className="font-display text-[28px] font-black text-t1 mb-1.5">⚡ Upgrade UniBuddy</h2>
          <p className="text-[14px] text-t3">Unlock more conversations. Connect further.</p>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-3 gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          {TIERS.map(tier => {
            const isCurr = currentTier === tier.id
            const isFeat = tier.id === 'plus'
            return (
              <div
                key={tier.id}
                className="relative bg-elev rounded-lg p-6 flex flex-col gap-2.5 transition-all hover:translate-y-[-2px]"
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
                  <span className="absolute top-[-13px] left-1/2 -translate-x-1/2 text-[11px] font-black px-3 py-[3px] rounded-2xl bg-accent text-white whitespace-nowrap">
                    {tier.badge}
                  </span>
                )}
                {isCurr && (
                  <span className="absolute top-[-13px] left-1/2 -translate-x-1/2 text-[11px] font-black px-3 py-[3px] rounded-2xl bg-green text-white whitespace-nowrap">
                    ✓ Current
                  </span>
                )}

                <h3 className="font-display text-[18px] font-black" style={{ color: tier.color }}>{tier.name}</h3>
                <p className="text-[13px] text-t3 font-medium">{tier.scope}</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-[32px] font-black text-t1">{tier.price}</span>
                  <span className="text-[13px] text-t3">{tier.per}</span>
                </div>
                <ul className="flex flex-col gap-[7px] flex-1">
                  {tier.features.map((f, i) => (
                    <li key={i} className="text-[13px] text-t2 flex items-start gap-[7px]">
                      <span className="font-black shrink-0 text-green">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurr ? (
                  <button
                    disabled
                    className="mt-1.5 w-full py-[11px] rounded-md text-[14px] font-bold border-none cursor-default"
                    style={{ background: 'var(--green-sub)', color: 'var(--green)' }}
                  >
                    ✓ Active Plan
                  </button>
                ) : tier.id === 'free' ? (
                  <button
                    disabled
                    className="mt-1.5 w-full py-[11px] rounded-md text-[14px] font-bold border-none cursor-default"
                    style={{ background: 'var(--bg-float)', color: 'var(--t3)' }}
                  >
                    Free Forever
                  </button>
                ) : (
                  <div className="flex flex-col gap-1.5 mt-1.5">
                    {tier.plans.map(plan => (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan.id)}
                        className="w-full py-[9px] rounded-sm text-[13px] font-bold border border-bdr text-t2 bg-float transition-all hover:translate-y-[-1px] hover:shadow-sm"
                        style={{ background: 'var(--bg-float)' }}
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

        <p className="text-center text-[13px] text-t4 pt-4 border-t border-bdr">
          🔒 Secured by Razorpay · UPI, Cards, NetBanking accepted · Cancel anytime
        </p>
      </div>
    </div>
  )
}
