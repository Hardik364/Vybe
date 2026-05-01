// CheckoutModal — Razorpay checkout for UniBuddy plans
// Props:
//   selectedPlan  — 'day-pass' | 'week-pass' | 'plus-monthly' | 'pro-monthly'
//   onSuccess(tier) — called after payment verified
//   onClose     — called when user dismisses modal

import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_APP_WEBSOCKET_URL

const PLAN_META = {
    'day-pass':     { label: 'Day Pass',    amount: '₹19',  duration: '24 hours',  tier: 'plus', color: '#6C63FF' },
    'week-pass':    { label: 'Week Pass',   amount: '₹49',  duration: '7 days',    tier: 'pro',  color: '#F59E0B' },
    'plus-monthly': { label: 'Plus',        amount: '₹49',  duration: '1 month',   tier: 'plus', color: '#6C63FF' },
    'pro-monthly':  { label: 'Pro',         amount: '₹99',  duration: '1 month',   tier: 'pro',  color: '#F59E0B' },
}

// Dynamically load the Razorpay checkout script
function loadRazorpayScript() {
    return new Promise(resolve => {
        if (document.getElementById('rzp-script')) return resolve(true)
        const script = document.createElement('script')
        script.id  = 'rzp-script'
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload  = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
    })
}

export default function CheckoutModal({ selectedPlan, onSuccess, onClose }) {
    const [step,    setStep]    = useState('confirm')  // 'confirm' | 'paying' | 'success' | 'error'
    const [errMsg,  setErrMsg]  = useState('')
    const [newTier, setNewTier] = useState(null)

    const plan = PLAN_META[selectedPlan]
    if (!plan) return null

    async function handlePay() {
        setStep('paying')
        const token = localStorage.getItem('ub_token')
        if (!token) { setErrMsg('Please log in to purchase'); setStep('error'); return }

        // 1 — create Razorpay order on server
        let orderData
        try {
            const res = await fetch(`${API}/payments/create-order`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body:    JSON.stringify({ planId: selectedPlan }),
            })
            orderData = await res.json()
            if (!res.ok) {
                // "Coming soon" or other server message
                setErrMsg(orderData.error || 'Could not create order')
                setStep('error')
                return
            }
        } catch {
            setErrMsg('Cannot reach server. Check your connection.')
            setStep('error')
            return
        }

        // 2 — load Razorpay script
        const loaded = await loadRazorpayScript()
        if (!loaded) { setErrMsg('Could not load payment gateway. Try again.'); setStep('error'); return }

        // 3 — open Razorpay checkout
        const rzpOptions = {
            key:         orderData.keyId,
            amount:      orderData.amount,
            currency:    orderData.currency,
            name:        'UniBuddy',
            description: `${plan.label} — ${plan.duration}`,
            order_id:    orderData.orderId,
            theme:       { color: plan.color },
            modal:       { ondismiss: () => setStep('confirm') },

            handler: async (response) => {
                // 4 — verify on server
                try {
                    const vRes = await fetch(`${API}/payments/verify`, {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body:    JSON.stringify({
                            razorpay_order_id:   response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature:  response.razorpay_signature,
                            planId:              selectedPlan,
                        }),
                    })
                    const vData = await vRes.json()
                    if (!vRes.ok) { setErrMsg(vData.error || 'Verification failed'); setStep('error'); return }
                    setNewTier(vData.tier)
                    setStep('success')
                    onSuccess?.(vData.tier)
                } catch {
                    setErrMsg('Payment received but verification failed. Contact support.')
                    setStep('error')
                }
            },
        }

        const rzp = new window.Razorpay(rzpOptions)
        rzp.open()
    }

    // ── Error state ──────────────────────────────────────────
    if (step === 'error') return (
        <div id="checkoutOverlay" onClick={onClose}>
            <div id="checkoutModal" onClick={e => e.stopPropagation()}>
                <button className="checkout-close" onClick={onClose}>✕</button>
                <div className="checkout-status-icon">❌</div>
                <h3 className="checkout-status-title">Payment Failed</h3>
                <p className="checkout-status-body">{errMsg}</p>
                <button className="checkout-retry-btn" onClick={() => setStep('confirm')}>Try Again</button>
            </div>
        </div>
    )

    // ── Success state ────────────────────────────────────────
    if (step === 'success') return (
        <div id="checkoutOverlay" onClick={onClose}>
            <div id="checkoutModal" onClick={e => e.stopPropagation()}>
                <div className="checkout-status-icon">🎉</div>
                <h3 className="checkout-status-title">You're all set!</h3>
                <p className="checkout-status-body">
                    Your <strong>{plan.label}</strong> is active for {plan.duration}.
                    Reload to start matching across{' '}
                    {newTier === 'pro' ? 'all colleges worldwide' : 'same-state colleges'}.
                </p>
                <button className="checkout-primary-btn" onClick={() => window.location.reload()}>
                    Start Exploring →
                </button>
            </div>
        </div>
    )

    // ── Confirm / paying state ───────────────────────────────
    return (
        <div id="checkoutOverlay" onClick={step === 'confirm' ? onClose : undefined}>
            <div id="checkoutModal" onClick={e => e.stopPropagation()}>
                {step === 'confirm' && (
                    <button className="checkout-close" onClick={onClose}>✕</button>
                )}

                <div className="checkout-plan-badge" style={{ background: plan.color }}>
                    {plan.label}
                </div>

                <div className="checkout-amount">{plan.amount}</div>
                <p className="checkout-duration">Valid for {plan.duration}</p>

                <ul className="checkout-perks">
                    {plan.tier === 'plus' && <>
                        <li>✓ Match across same-state colleges</li>
                        <li>✓ Priority in matching queue</li>
                        <li>✓ All Free features included</li>
                    </>}
                    {plan.tier === 'pro' && <>
                        <li>✓ Match any college worldwide</li>
                        <li>✓ Priority in matching queue</li>
                        <li>✓ All Plus features included</li>
                        <li>✓ Early access to new features</li>
                    </>}
                </ul>

                <button
                    className="checkout-primary-btn"
                    onClick={handlePay}
                    disabled={step === 'paying'}
                >
                    {step === 'paying' ? (
                        <span className="checkout-spinner">Processing…</span>
                    ) : (
                        `Pay ${plan.amount} with Razorpay`
                    )}
                </button>

                <p className="checkout-note">
                    🔒 Secured by Razorpay · UPI, Cards, NetBanking accepted
                </p>
            </div>
        </div>
    )
}
