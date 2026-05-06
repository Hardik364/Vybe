'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import UpgradeModal from '@/components/modals/UpgradeModal'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

const TIER_INFO = {
  free: { label: 'Free',  color: 'oklch(55% 0.01 265)', scope: 'Your college only' },
  plus: { label: 'Plus',  color: 'var(--accent)',        scope: 'Same state colleges' },
  pro:  { label: 'Pro',   color: 'var(--amber)',         scope: 'Any college globally' },
}

export default function AccountPage() {
  const router = useRouter()
  const [user,     setUser]     = useState(null)
  const [tier,     setTier]     = useState('free')
  const [history,  setHistory]  = useState([])
  const [showUp,   setShowUp]   = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('ub_token')
    if (!token) { router.push('/signup'); return }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.valid) { router.push('/signup'); return }
        setUser(d)
        setTier(d.tier || 'free')
        setHistory(d.purchaseHistory || [])
      })
      .catch(() => router.push('/signup'))
  }, [])

  function logout() {
    localStorage.clear()
    router.push('/signup')
  }

  const info = TIER_INFO[tier] || TIER_INFO.free

  if (!user) return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spinAnim .9s linear infinite' }} />
    </div>
  )

  return (
    <div className="absolute inset-0 bg-base flex flex-col overflow-hidden">
      {/* Top nav */}
      <nav className="h-14 flex items-center px-5 gap-4 border-b z-10 shrink-0 backdrop-blur-2xl" style={{ background: 'var(--glass)', borderColor: 'var(--glass-b)' }}>
        <button
          onClick={() => router.push('/chat')}
          className="text-[14px] font-bold text-accent flex items-center gap-1.5 transition-opacity hover:opacity-75"
        >
          ← Back to Chat
        </button>
        <span className="font-display text-[16px] font-black text-t1">Account</span>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </nav>

      {/* Split body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — cards */}
        <div className="w-[420px] min-w-[360px] overflow-y-auto p-7 flex flex-col gap-3.5 border-r border-bdr shrink-0">
          {/* Profile */}
          <Card>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[26px] font-black shrink-0 font-display"
                style={{
                  background: 'linear-gradient(135deg,var(--accent),oklch(58% 0.24 310))',
                  boxShadow: '0 6px 24px var(--accent-glow)',
                }}
              >
                {user.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="font-display text-[22px] font-black text-t1">{user.username}</div>
                <div className="text-[13px] text-t3 mt-0.5">
                  🎓 Logged in via college email · {user.college || 'Verified Student'}
                </div>
              </div>
            </div>
          </Card>

          {/* Plan */}
          <Card>
            <div className="text-[11px] font-black text-t3 uppercase tracking-[0.8px]">Current Plan</div>
            <div className="flex items-center gap-3">
              <span className="px-4 py-[5px] rounded-2xl text-[13px] font-black text-white" style={{ background: info.color }}>
                {info.label}
              </span>
              <span className="text-[14px] text-t2">{info.scope}</span>
            </div>
            {tier === 'free' && (
              <p className="text-[13px] text-t3 leading-[1.5]">You're on the free plan. Upgrade to match students beyond your college. 🚀</p>
            )}
            <button
              onClick={() => setShowUp(true)}
              className="py-[13px] rounded-md text-[14px] font-black text-white border-none transition-all hover:translate-y-[-1px] hover:shadow-md relative overflow-hidden"
              style={{ background: tier === 'free' ? 'var(--accent)' : info.color }}
            >
              <span className="absolute inset-0 bg-[linear-gradient(135deg,oklch(100%_0_0/0.1),transparent)] pointer-events-none" />
              {tier === 'free' ? '⚡ Upgrade Plan' : '🔄 Change Plan'}
            </button>
          </Card>

          {/* History */}
          <Card>
            <div className="text-[11px] font-black text-t3 uppercase tracking-[0.8px]">Purchase History</div>
            <div className="flex flex-col gap-2">
              {history.length === 0 ? (
                <p className="text-[14px] text-t4">No purchases yet</p>
              ) : history.map((h, i) => (
                <div key={i} className="flex items-center justify-between px-3.5 py-[11px] bg-elev rounded-md transition-all hover:bg-float">
                  <div>
                    <div className="text-[14px] font-bold text-t1">{h.planId}</div>
                    <div className="text-[12px] text-t4 mt-0.5">{new Date(h.activatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <span className="text-[13px] font-black" style={{ color: TIER_INFO[h.tier]?.color }}>{TIER_INFO[h.tier]?.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Logout */}
          <div
            className="bg-surf rounded-xl p-[22px] flex flex-col gap-3 shadow-sm"
            style={{ border: '1px solid oklch(62% 0.24 25 / 0.2)' }}
          >
            <div className="text-[11px] font-black text-t3 uppercase tracking-[0.8px]">Sign Out</div>
            <button
              onClick={logout}
              className="py-[13px] rounded-md text-[14px] font-bold border transition-all hover:bg-red-sub"
              style={{ color: 'var(--red)', borderColor: 'var(--red)', background: 'none' }}
            >
              🚪 Log Out
            </button>
          </div>
        </div>

        {/* Right — 3D orbit canvas */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-base">
          <AccountCanvas />

          {/* Overlay content */}
          <div className="relative z-[2] flex flex-col items-center gap-7 p-10 text-center pointer-events-none w-full">
            <div>
              <p className="text-[11px] font-black tracking-[2px] uppercase text-accent mb-3">Your Network</p>
              <h2
                className="font-display font-black text-t1 tracking-[-1px] leading-[1.1] mb-2.5"
                style={{ fontSize: 'clamp(28px, 3vw, 42px)' }}
              >
                Students.<br />Connected.
              </h2>
              <p className="text-[15px] text-t2 max-w-[340px] leading-[1.6] mx-auto">
                Every node is a college. Every line is a conversation. Upgrade to unlock more connections. 🌍
              </p>
            </div>

            {/* Floating stat cards */}
            <div className="flex flex-col gap-2.5 w-full max-w-[280px] pointer-events-auto">
              {[
                { label: 'Your College', value: user.college || 'Verified', border: 'var(--accent)', bg: 'var(--accent-glow)' },
                { label: 'Conversations', value: `${user.callCount || 0} total`, border: 'var(--green)', bg: 'var(--green-sub)' },
                { label: 'Karma Score', value: user.karma || 'Great 😊', border: 'var(--amber)', bg: 'var(--amber-sub)' },
              ].map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg px-5 py-3.5 backdrop-blur-xl shadow-md"
                  style={{ background: s.bg, border: `1px solid ${s.border}`, animation: `float 4s ease-in-out ${i * 1.3}s infinite` }}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.border, boxShadow: `0 0 8px ${s.border}` }} />
                  <div>
                    <div className="text-[12px] text-t3 font-semibold">{s.label}</div>
                    <div className="text-[15px] text-t1 font-black">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showUp && (
        <UpgradeModal
          currentTier={tier}
          onClose={() => setShowUp(false)}
          onTierChange={t => { setTier(t); setShowUp(false) }}
        />
      )}
    </div>
  )
}

function Card({ children }) {
  return (
    <div className="bg-surf border border-bdr rounded-xl p-[22px] flex flex-col gap-3 shadow-sm transition-all hover:border-bdr-s">
      {children}
    </div>
  )
}

function AccountCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W, H, raf
    let mouse = { x: -999, y: -999 }
    const DARK = () => document.documentElement.getAttribute('data-theme') === 'dark'

    const orbits = [
      { r: 80,  speed: 0.6,   nodes: [{ hue: 280, label: 'IIT', color: 'oklch(64% 0.22 280)' }, { hue: 160, label: 'NIT', color: 'oklch(67% 0.2 160)' }] },
      { r: 138, speed: -0.38, nodes: [{ hue: 55, label: 'BITS', color: 'oklch(72% 0.18 55)' }, { hue: 200, label: 'VIT', color: 'oklch(65% 0.19 200)' }, { hue: 25, label: 'DTU', color: 'oklch(62% 0.22 25)' }] },
      { r: 195, speed: 0.22,  nodes: [{ hue: 310, label: 'IITM', color: 'oklch(64% 0.2 310)' }, { hue: 130, label: 'MIT', color: 'oklch(66% 0.19 130)' }, { hue: 240, label: 'DU', color: 'oklch(63% 0.21 240)' }, { hue: 80, label: 'JNU', color: 'oklch(68% 0.17 80)' }] },
    ]

    let particles = []
    function initParticles() {
      particles = Array.from({ length: 60 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
        r: Math.random() * 1.8 + .5,
        hue: [280, 160, 55, 200, 310][Math.floor(Math.random() * 5)],
        alpha: Math.random() * .5 + .15,
      }))
    }

    function resize() {
      W = canvas.width = canvas.offsetWidth
      H = canvas.height = canvas.offsetHeight
      initParticles()
    }

    let t = 0
    function draw() {
      ctx.clearRect(0, 0, W, H)
      t += 0.012
      const dark = DARK()
      const cx = W / 2, cy = H / 2
      const mx = (mouse.x / W - .5) * 18
      const my = (mouse.y / H - .5) * 18

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = dark ? `oklch(65% 0.15 ${p.hue} / ${p.alpha})` : `oklch(50% 0.12 ${p.hue} / ${p.alpha * .5})`
        ctx.fill()
      })

      orbits.forEach(orb => {
        const angle = t * orb.speed
        ctx.beginPath()
        ctx.ellipse(cx + mx * .5, cy + my * .5, orb.r, orb.r * .36, -0.25, 0, Math.PI * 2)
        ctx.strokeStyle = dark ? `oklch(65% 0.1 280 / 0.18)` : `oklch(50% 0.08 280 / 0.14)`
        ctx.lineWidth = 1; ctx.setLineDash([4, 8]); ctx.stroke(); ctx.setLineDash([])

        orb.nodes.forEach((node, ni) => {
          const a = angle + (ni / orb.nodes.length) * Math.PI * 2
          const nx = cx + mx * .5 + Math.cos(a) * orb.r
          const ny = cy + my * .5 + Math.sin(a) * orb.r * .36
          const scale = 0.6 + 0.4 * ((Math.sin(a) + 1) / 2)
          const nodeR = 12 * scale
          const linAlpha = (dark ? .18 : .1) * scale

          const grad = ctx.createLinearGradient(cx, cy, nx, ny)
          grad.addColorStop(0, `oklch(65% 0.2 280 / ${linAlpha * 2})`)
          grad.addColorStop(1, `oklch(65% 0.2 ${node.hue} / ${linAlpha})`)
          ctx.beginPath(); ctx.moveTo(cx + mx * .3, cy + my * .3); ctx.lineTo(nx, ny)
          ctx.strokeStyle = grad; ctx.lineWidth = 1 + scale; ctx.stroke()

          const grd = ctx.createRadialGradient(nx, ny, 0, nx, ny, nodeR * 3)
          grd.addColorStop(0, `oklch(65% 0.2 ${node.hue} / ${.3 * scale})`); grd.addColorStop(1, 'transparent')
          ctx.beginPath(); ctx.arc(nx, ny, nodeR * 3, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill()

          ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, Math.PI * 2)
          ctx.fillStyle = node.color; ctx.globalAlpha = .85 * scale; ctx.fill(); ctx.globalAlpha = 1

          ctx.font = `700 ${Math.round(9 * scale)}px 'DM Sans',sans-serif`
          ctx.fillStyle = dark ? `oklch(97% 0 0 / ${.95 * scale})` : `oklch(10% 0 0 / ${.9 * scale})`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(node.label, nx, ny)
        })
      })

      const cG = ctx.createRadialGradient(cx + mx * .2, cy + my * .2, 0, cx + mx * .2, cy + my * .2, 60)
      cG.addColorStop(0, dark ? 'oklch(64% 0.22 280 / 0.35)' : 'oklch(64% 0.18 280 / 0.2)')
      cG.addColorStop(1, 'transparent')
      ctx.beginPath(); ctx.arc(cx + mx * .2, cy + my * .2, 60, 0, Math.PI * 2); ctx.fillStyle = cG; ctx.fill()

      raf = requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    raf = requestAnimationFrame(draw)

    const mm = e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top }
    const ml = () => { mouse.x = -999; mouse.y = -999 }
    canvas.addEventListener('mousemove', mm)
    canvas.addEventListener('mouseleave', ml)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      canvas.removeEventListener('mousemove', mm)
      canvas.removeEventListener('mouseleave', ml)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}
