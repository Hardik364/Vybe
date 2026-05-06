'use client'
import { useEffect, useRef } from 'react'

export default function BgCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let W, H
    let mouse = { x: -9999, y: -9999 }
    let raf
    let nodes = []

    const NODE_COUNT = 55
    const MAX_DIST = 180
    const DARK = () => document.documentElement.getAttribute('data-theme') === 'dark'

    function resize() {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }

    function makeNode(i) {
      const z = 0.3 + Math.random() * 0.7
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        z,
        r: 2 + z * 3,
        pulseOffset: Math.random() * Math.PI * 2,
        hue: [280, 160, 55, 25, 200][i % 5],
        _px: 0, _py: 0,
      }
    }

    function init() {
      nodes = Array.from({ length: NODE_COUNT }, (_, i) => makeNode(i))
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H)
      const dark = DARK()
      const now = t * 0.001
      const mx = (mouse.x / W - 0.5) * 60
      const my = (mouse.y / H - 0.5) * 60

      nodes.forEach(n => {
        n._px = n.x + mx * n.z * 0.5
        n._py = n.y + my * n.z * 0.5
        n.x += n.vx; n.y += n.vy
        if (n.x < -20) n.x = W + 20
        if (n.x > W + 20) n.x = -20
        if (n.y < -20) n.y = H + 20
        if (n.y > H + 20) n.y = -20
      })

      // Connections
      nodes.forEach((a, i) => {
        nodes.forEach((b, j) => {
          if (j <= i) return
          const dx = a._px - b._px
          const dy = a._py - b._py
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > MAX_DIST) return
          const alpha = (1 - dist / MAX_DIST) * 0.55 * ((a.z + b.z) / 2)
          const pulse = 0.6 + 0.4 * Math.sin(now * 1.5 + a.pulseOffset)
          const grad = ctx.createLinearGradient(a._px, a._py, b._px, b._py)
          const hue = (a.hue + b.hue) / 2
          const lStr = dark
            ? `oklch(64% 0.22 ${hue} / ${alpha * pulse})`
            : `oklch(50% 0.18 ${hue} / ${alpha * 0.5 * pulse})`
          grad.addColorStop(0, lStr)
          grad.addColorStop(0.5, dark
            ? `oklch(70% 0.2 280 / ${alpha * pulse * 0.8})`
            : `oklch(55% 0.15 280 / ${alpha * 0.4 * pulse})`)
          grad.addColorStop(1, lStr)
          ctx.beginPath()
          ctx.strokeStyle = grad
          ctx.lineWidth = 0.8 + ((a.z + b.z) / 2) * 0.8
          ctx.moveTo(a._px, a._py)
          ctx.lineTo(b._px, b._py)
          ctx.stroke()
        })
      })

      // Nodes
      nodes.forEach(n => {
        const pulse = 0.85 + 0.15 * Math.sin(now * 2 + n.pulseOffset)
        const r = n.r * pulse
        const alpha = dark ? 0.65 + n.z * 0.35 : 0.4 + n.z * 0.35

        const grd = ctx.createRadialGradient(n._px, n._py, 0, n._px, n._py, r * 4)
        grd.addColorStop(0, dark
          ? `oklch(65% 0.2 ${n.hue} / ${alpha * 0.25})`
          : `oklch(55% 0.15 ${n.hue} / ${alpha * 0.12})`)
        grd.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(n._px, n._py, r * 4, 0, Math.PI * 2)
        ctx.fillStyle = grd; ctx.fill()

        ctx.beginPath(); ctx.arc(n._px, n._py, r, 0, Math.PI * 2)
        ctx.fillStyle = dark
          ? `oklch(72% 0.2 ${n.hue} / ${alpha})`
          : `oklch(55% 0.18 ${n.hue} / ${alpha})`
        ctx.fill()

        const mdx = n._px - mouse.x, mdy = n._py - mouse.y
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy)
        if (mdist < 120) {
          const mAlpha = (1 - mdist / 120) * 0.7
          ctx.beginPath()
          ctx.arc(n._px, n._py, r + 4 * (1 - mdist / 120), 0, Math.PI * 2)
          ctx.strokeStyle = dark
            ? `oklch(80% 0.2 ${n.hue} / ${mAlpha})`
            : `oklch(60% 0.18 ${n.hue} / ${mAlpha * 0.6})`
          ctx.lineWidth = 1.5; ctx.stroke()
        }
      })

      raf = requestAnimationFrame(draw)
    }

    const onResize = () => { resize(); init() }
    const onMove = e => { mouse.x = e.clientX; mouse.y = e.clientY }
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999 }

    window.addEventListener('resize', onResize)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    resize(); init()
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return <canvas id="bg-canvas" ref={canvasRef} aria-hidden="true" />
}
