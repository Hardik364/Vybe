'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('ub_token')
    if (!token) { router.push('/signup'); return }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.valid) { router.push('/signup'); return }
        setUser(d)
      })
      .catch(() => router.push('/signup'))
  }, [])

  function logout() {
    localStorage.clear()
    router.push('/signup')
  }

  if (!user) return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spinAnim .9s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top nav */}
      <nav className="navbar">
        <button
          onClick={() => router.push('/chat')}
          style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'opacity var(--t-fast)' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
          onMouseLeave={e => e.currentTarget.style.opacity = ''}
        >
          ← Back to Chat
        </button>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 900, color: 'var(--t1)' }}>Account</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle />
        </div>
      </nav>

      {/* Split body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left column — cards */}
        <div className="acc-left">
          {/* Profile card */}
          <div className="acc-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="acc-avatar">
                {user.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900, color: 'var(--t1)' }}>
                  {user.username}
                </div>
                <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 2 }}>
                  ✉️ {user.email || 'Verified Account'}
                </div>
              </div>
            </div>
          </div>

          {/* Sign out */}
          <div style={{
            background: 'var(--bg-surf)',
            border: '1px solid oklch(62% 0.24 25 / 0.2)',
            borderRadius: 'var(--r-xl)', padding: 22,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Sign Out
            </div>
            <button
              onClick={logout}
              style={{
                padding: '13px 0', borderRadius: 'var(--r-md)',
                fontSize: 14, fontWeight: 700,
                border: '1px solid var(--red)', color: 'var(--red)',
                background: 'none', cursor: 'pointer',
                transition: 'background var(--t-fast)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--red-sub)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              🚪 Log Out
            </button>
          </div>
        </div>

        {/* Right — 3D orbit canvas */}
        <div className="acc-right">
          <AccountCanvas />

          {/* Overlay content */}
          <div style={{
            position: 'relative', zIndex: 2,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 28, padding: 40, textAlign: 'center',
            pointerEvents: 'none', width: '100%',
          }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
                Your Network
              </p>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--t1)',
                letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 10,
                fontSize: 'clamp(28px, 3vw, 42px)',
              }}>
                Students.<br />Connected.
              </h2>
              <p style={{ fontSize: 15, color: 'var(--t2)', maxWidth: 340, lineHeight: 1.6, margin: '0 auto' }}>
                Every node is a college. Every line is a conversation. Start talking — your next great conversation is one tap away. 🌍
              </p>
            </div>

            {/* Floating stat cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280, pointerEvents: 'auto' }}>
              {[
                { label: 'Your College', value: user.college || 'Verified', border: 'var(--accent)', bg: 'var(--accent-glow)' },
                { label: 'Conversations', value: `${user.callCount || 0} total`, border: 'var(--green)', bg: 'var(--green-sub)' },
                { label: 'Karma Score', value: user.karma || 'Great 😊', border: 'var(--amber)', bg: 'var(--amber-sub)' },
              ].map((s, i) => (
                <div
                  key={i}
                  className="acc-float-stat"
                  style={{ animationDelay: `${i * 1.3}s`, background: s.bg, border: `1px solid ${s.border}` }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.border, boxShadow: `0 0 8px ${s.border}`, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 15, color: 'var(--t1)', fontWeight: 900 }}>{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
}
