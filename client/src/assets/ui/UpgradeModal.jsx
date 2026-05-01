import { useState } from 'react'
import CheckoutModal from './CheckoutModal'

const TIERS = [
    {
        id:        'free',
        name:      'Free',
        price:     '₹0',
        period:    'forever',
        scope:     '🏫 Your college only',
        color:     '#A0A0A0',
        features:  [
            'Match within your college',
            'Voice + video chat',
            'Conversation prompts on match',
            'Karma protection system',
        ],
        plans:     [],
    },
    {
        id:        'plus',
        name:      'Plus',
        price:     '₹49',
        period:    '/month',
        scope:     '🏙️ Same city colleges',
        color:     '#6C63FF',
        features:  [
            'Everything in Free',
            'Match across your city',
            'Priority matching queue',
        ],
        plans: [
            { planId: 'day-pass',     label: '₹19  Day Pass'   },
            { planId: 'plus-monthly', label: '₹49 / month'     },
        ],
    },
    {
        id:        'pro',
        name:      'Pro',
        price:     '₹99',
        period:    '/month',
        scope:     '🌍 Any college globally',
        color:     '#F59E0B',
        features:  [
            'Everything in Plus',
            'Match any college worldwide',
            'Early access to features',
        ],
        plans: [
            { planId: 'week-pass',   label: '₹49  Week Pass'  },
            { planId: 'pro-monthly', label: '₹99 / month'     },
        ],
    },
]

export default function UpgradeModal({ currentTier = 'free', onClose, onTierChange }) {
    const [checkoutPlan, setCheckoutPlan] = useState(null)

    function handleSuccess(tier) {
        setCheckoutPlan(null)
        onTierChange?.(tier)
    }

    if (checkoutPlan) return (
        <CheckoutModal
            selectedPlan={checkoutPlan}
            onSuccess={handleSuccess}
            onClose={() => setCheckoutPlan(null)}
        />
    )

    return (
        <div id="upgradeOverlay" onClick={onClose}>
            <div id="upgradeModal" onClick={e => e.stopPropagation()}>
                <div id="upgrade-header">
                    <h2 id="upgrade-title">Choose Your Plan</h2>
                    <p id="upgrade-subtitle">Expand your reach — cancel anytime</p>
                    <button id="upgrade-close" onClick={onClose}>✕</button>
                </div>

                <div id="upgrade-tiers">
                    {TIERS.map(tier => {
                        const isCurrent = tier.id === currentTier
                        return (
                            <div
                                key={tier.id}
                                className={`upgrade-card${isCurrent ? ' current' : ''}${tier.id === 'plus' ? ' featured' : ''}`}
                                style={{ '--tier-color': tier.color }}
                            >
                                {tier.id === 'plus' && (
                                    <div className="tier-popular-badge">Most Popular</div>
                                )}
                                {isCurrent && (
                                    <div className="tier-current-badge">Your Plan</div>
                                )}

                                <div className="tier-name" style={{ color: tier.color }}>{tier.name}</div>
                                <div className="tier-price">
                                    <span className="tier-price-amount">{tier.price}</span>
                                    <span className="tier-price-period">{tier.period}</span>
                                </div>
                                <div className="tier-scope">{tier.scope}</div>

                                <ul className="tier-features">
                                    {tier.features.map((f, i) => (
                                        <li key={i} className="tier-feature">
                                            <span className="tier-check">✓</span> {f}
                                        </li>
                                    ))}
                                </ul>

                                {/* Plan buttons */}
                                {isCurrent ? (
                                    <button className="tier-cta active-plan" disabled>✓ Active Plan</button>
                                ) : tier.plans.length === 0 ? (
                                    <button className="tier-cta active-plan" disabled>Always Free</button>
                                ) : tier.plans.length === 1 ? (
                                    <button
                                        className="tier-cta"
                                        style={{ background: tier.color }}
                                        onClick={() => setCheckoutPlan(tier.plans[0].planId)}
                                    >
                                        {tier.plans[0].label} →
                                    </button>
                                ) : (
                                    <div className="tier-plan-btns">
                                        {tier.plans.map(p => (
                                            <button
                                                key={p.planId}
                                                className="tier-plan-btn"
                                                style={{ '--btn-color': tier.color }}
                                                onClick={() => setCheckoutPlan(p.planId)}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <p id="upgrade-note">
                    💡 UPI · Cards · NetBanking · No auto-renew for passes
                </p>
            </div>
        </div>
    )
}
