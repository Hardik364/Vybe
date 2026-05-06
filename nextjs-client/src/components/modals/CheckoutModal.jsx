'use client'
import { useState } from 'react'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

const PLAN_META = {
  'day-pass':     { label: 'Day Pass',  amount: '₹19', duration: '24 hours', tier: 'plus', color: 'var(--accent)' },
  'week-pass':    { label: 'Week Pass', amount: '₹49', duration: '7 days',   tier: 'pro',  color: 'var(--amber)'  },
  'plus-monthly': { label: 'Plus',      amount: '₹49', duration: '1 month',  tier: 'plus', color: 'var(--accent)' },
  'pro-monthly':  { label: 'Pro',       amount: '₹99', duration: '1 month',  tier: 'pro',  color: 'var(--amber)'  },
}

function loadRazorpay() {
  return new Promise(resolve => {
    if (document.getElementById('rzp-script')) return resolve(true)
    const s = document.createElement('script')
    s.id = 'rzp-script'; s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true); s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export default function CheckoutModal({ selectedPlan, onSuccess, onClose }) {
  const [step, setStep]     = useState('confirm')
  const [errMsg, setErrMsg] = useState('')
  const [newTier, setNewTier] = useState(null)

  const plan = PLAN_META[selectedPlan]
  if (!plan) return null

  async function handlePay() {
    setStep('paying')
    const token = localStorage.getItem('ub_token')
    if (!token) { setErrMsg('Please log in'); setStep('error'); return }

    let orderData
    try {
      const res = await fetch(`${API}/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId: selectedPlan }),
      })
      orderData = await res.json()
      if (!res.ok) { setErrMsg(orderData.error || 'Could not create order'); setStep('error'); return }
    } catch { setErrMsg('Cannot reach server.'); setStep('error'); return }

    const loaded = await loadRazorpay()
    if (!loaded) { setErrMsg('Could not load payment gateway.'); setStep('error'); return }

    const rzp = new window.Razorpay({
      key: orderData.keyId, amount: orderData.amount, currency: orderData.currency,
      name: 'UniBuddy', description: `${plan.label} — ${plan.duration}`,
      order_id: orderData.orderId, theme: { color: '#7c3aed' },
      modal: { ondismiss: () => setStep('confirm') },
      handler: async (response) => {
        try {
          const vRes = await fetch(`${API}/payments/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ...response, planId: selectedPlan }),
          })
          const vData = await vRes.json()
          if (!vRes.ok) { setErrMsg(vData.error || 'Verification failed'); setStep('error'); return }
          setNewTier(vData.tier); setStep('success'); onSuccess?.(vData.tier)
        } catch { setErrMsg('Payment received but verification failed.'); setStep('error') }
      },
    })
    rzp.open()
  }

  if (step === 'error') return (
    <div className="bg-surf border border-bdr rounded-xl p-10 w-full max-w-[380px] flex flex-col items-center gap-3.5 text-center shadow-lg animate-pop-in relative">
      <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 rounded-2xl flex items-center justify-center text-t3 text-[14px] hover:bg-elev hover:text-t1 transition-all">✕</button>
      <div className="text-[40px]">❌</div>
      <h3 className="font-display text-[20px] font-bold text-t1">Payment Failed</h3>
      <p className="text-[14px] text-t2">{errMsg}</p>
      <button onClick={() => setStep('confirm')} className="w-full py-[13px] rounded-md bg-accent text-white font-bold hover:bg-accent-h transition-all">Try Again</button>
    </div>
  )

  if (step === 'success') return (
    <div className="bg-surf border border-bdr rounded-xl p-10 w-full max-w-[380px] flex flex-col items-center gap-3.5 text-center shadow-lg animate-pop-in">
      <div className="text-[40px]">🎉</div>
      <h3 className="font-display text-[20px] font-bold text-t1">You're all set!</h3>
      <p className="text-[14px] text-t2">
        Your <strong>{plan.label}</strong> is active for {plan.duration}.
        Reload to start matching across{' '}
        {newTier === 'pro' ? 'all colleges worldwide 🌍' : 'same-state colleges 🎓'}.
      </p>
      <button onClick={() => window.location.reload()} className="w-full py-[13px] rounded-md bg-accent text-white font-bold hover:bg-accent-h transition-all">
        🚀 Start Exploring →
      </button>
    </div>
  )

  return (
    <div className="bg-surf border border-bdr rounded-xl p-10 w-full max-w-[380px] flex flex-col items-center gap-3.5 text-center shadow-lg animate-pop-in relative">
      {step === 'confirm' && (
        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 rounded-2xl flex items-center justify-center text-t3 text-[14px] hover:bg-elev hover:text-t1 transition-all">✕</button>
      )}
      <span className="px-[18px] py-[6px] rounded-2xl text-[13px] font-black text-white" style={{ background: plan.color }}>{plan.label}</span>
      <span className="font-display text-[52px] font-black text-t1 leading-none">{plan.amount}</span>
      <p className="text-[13px] text-t3">Valid for {plan.duration}</p>
      <ul className="w-full flex flex-col gap-2 text-left px-2">
        {plan.tier === 'plus' && [
          '✓ Match across same-state colleges 🎓',
          '✓ Priority in matching queue ⚡',
          '✓ All Free features included',
        ].map((f, i) => <li key={i} className="text-[14px] text-t2 flex items-center gap-2">{f}</li>)}
        {plan.tier === 'pro' && [
          '✓ Match any college worldwide 🌍',
          '✓ Priority in matching queue ⚡',
          '✓ All Plus features included',
          '✓ Early access to new features 🚀',
        ].map((f, i) => <li key={i} className="text-[14px] text-t2 flex items-center gap-2">{f}</li>)}
      </ul>
      <button
        onClick={handlePay}
        disabled={step === 'paying'}
        className="w-full py-[15px] rounded-md bg-accent text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-accent-h transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
      >
        <span className="absolute inset-0 bg-[linear-gradient(135deg,oklch(100%_0_0/0.12),transparent_60%)] pointer-events-none" />
        {step === 'paying' ? (
          <span style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spinAnim .75s linear infinite', display: 'inline-block' }} />
        ) : `💳 Pay ${plan.amount} with Razorpay`}
      </button>
      <p className="text-[12px] text-t4">🔒 Secured by Razorpay · UPI, Cards, NetBanking</p>
    </div>
  )
}
