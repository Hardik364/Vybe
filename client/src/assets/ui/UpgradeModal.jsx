const TIERS = [
    {
        id:      'free',
        name:    'Free',
        price:   '₹0',
        period:  'forever',
        scope:   '🏫 Your college only',
        color:   '#A0A0A0',
        features: [
            'Match within your college',
            'Voice + text chat',
            'Conversation prompts',
            'Karma protection system',
        ],
        cta:     null,   // current plan — no button
    },
    {
        id:      'plus',
        name:    'Plus',
        price:   '₹49',
        period:  '/month',
        scope:   '🏙️ Same city colleges',
        color:   '#6C63FF',
        features: [
            'Everything in Free',
            'Match across your city',
            'Priority matching',
            'Day Pass: ₹19',
        ],
        cta:     'Coming Soon',
    },
    {
        id:      'pro',
        name:    'Pro',
        price:   '₹99',
        period:  '/month',
        scope:   '🌍 Any college globally',
        color:   '#F59E0B',
        features: [
            'Everything in Plus',
            'Match any college worldwide',
            'Week Pass: ₹49',
            'Early access to features',
        ],
        cta:     'Coming Soon',
    },
]

export default function UpgradeModal({ currentTier = 'free', onClose }) {
    return (
        <div id="upgradeOverlay" onClick={onClose}>
            <div id="upgradeModal" onClick={e => e.stopPropagation()}>
                <div id="upgrade-header">
                    <h2 id="upgrade-title">Choose Your Plan</h2>
                    <p id="upgrade-subtitle">Expand your reach when you're ready</p>
                    <button id="upgrade-close" onClick={onClose}>✕</button>
                </div>

                <div id="upgrade-tiers">
                    {TIERS.map(tier => {
                        const isCurrent = tier.id === currentTier
                        return (
                            <div
                                key={tier.id}
                                className={`upgrade-card ${isCurrent ? 'current' : ''} ${tier.id === 'plus' ? 'featured' : ''}`}
                                style={{ '--tier-color': tier.color }}
                            >
                                {tier.id === 'plus' && (
                                    <div className="tier-popular-badge">Most Popular</div>
                                )}
                                {isCurrent && (
                                    <div className="tier-current-badge">Your Plan</div>
                                )}

                                <div className="tier-name" style={{ color: tier.color }}>
                                    {tier.name}
                                </div>
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

                                {tier.cta ? (
                                    <button className="tier-cta coming-soon" disabled>
                                        {tier.cta}
                                    </button>
                                ) : (
                                    <button className="tier-cta active-plan" disabled>
                                        ✓ Active Plan
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>

                <p id="upgrade-note">
                    💡 RealTalk is free during launch — tell your friends and help us grow!
                </p>
            </div>
        </div>
    )
}
