import { useState, useEffect, useRef } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import SingUp from "./SingUp";
import ChatPage from "./ChatPage";
import AdminDashboard from "./AdminDashboard";
import CommunityPage from "./CommunityPage";
import AccountPage from "./AccountPage";
import { initIceServers } from "../utils/pcInstance";

// ── 3D Particle Network Canvas ────────────────────────────────
function ParticleCanvas() {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')

        let W = window.innerWidth
        let H = window.innerHeight
        canvas.width  = W
        canvas.height = H

        const COUNT = Math.min(70, Math.floor((W * H) / 18000))
        const LINK_DIST  = 140
        const LINK_DIST2 = LINK_DIST * LINK_DIST

        function isDark() {
            return document.documentElement.getAttribute('data-theme') !== 'light'
        }

        function makeParticle() {
            return {
                x: Math.random() * W,
                y: Math.random() * H,
                z: Math.random() * 2 + 0.5,          // depth 0.5–2.5
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
            }
        }

        let particles = Array.from({ length: COUNT }, makeParticle)

        function draw() {
            ctx.clearRect(0, 0, W, H)
            const dark = isDark()
            const dotColor  = dark ? '180,160,255' : '100,80,200'
            const lineColor = dark ? '140,120,220' : '80,60,180'

            for (let i = 0; i < particles.length; i++) {
                const a = particles[i]
                // Move
                a.x += a.vx * a.z
                a.y += a.vy * a.z
                // Wrap
                if (a.x < 0) a.x = W; if (a.x > W) a.x = 0
                if (a.y < 0) a.y = H; if (a.y > H) a.y = 0

                // Draw dot
                const r = a.z * 1.6
                ctx.beginPath()
                ctx.arc(a.x, a.y, r, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(${dotColor},${0.5 + a.z * 0.15})`
                ctx.fill()

                // Draw connections
                for (let j = i + 1; j < particles.length; j++) {
                    const b = particles[j]
                    const dx = a.x - b.x
                    const dy = a.y - b.y
                    const d2 = dx * dx + dy * dy
                    if (d2 < LINK_DIST2) {
                        const opacity = (1 - d2 / LINK_DIST2) * 0.35
                        ctx.beginPath()
                        ctx.moveTo(a.x, a.y)
                        ctx.lineTo(b.x, b.y)
                        ctx.strokeStyle = `rgba(${lineColor},${opacity})`
                        ctx.lineWidth = 0.8
                        ctx.stroke()
                    }
                }
            }
        }

        let raf
        function loop() { draw(); raf = requestAnimationFrame(loop) }
        loop()

        function onResize() {
            W = window.innerWidth; H = window.innerHeight
            canvas.width  = W;    canvas.height = H
        }
        window.addEventListener('resize', onResize)

        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('resize', onResize)
        }
    }, [])

    return <canvas id="particle-canvas" ref={canvasRef} aria-hidden="true" />
}

// ── App ───────────────────────────────────────────────────────
function App() {
    const [username, setUsername] = useState(null)

    // Warm up ICE server cache
    useEffect(() => { initIceServers() }, [])

    // Register service worker for Web Push (Notify Me)
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(err => {
                console.warn('[SW] Registration failed:', err)
            })
        }
    }, [])

    function handleSetUsername(name) {
        setUsername(name)
    }

    const router = createBrowserRouter([
        {
            path: '/',
            element: <SingUp setUsername={handleSetUsername} />,
        },
        {
            path: '/chat',
            element: <ChatPage username={username} setUsername={handleSetUsername} />
        },
        {
            path: '/admin',
            element: <AdminDashboard />
        },
        {
            path: '/community',
            element: <CommunityPage username={username} />
        },
        {
            path: '/account',
            element: <AccountPage />
        }
    ]);

    return (
        <>
            <ParticleCanvas />
            <RouterProvider router={router} />
        </>
    )
}

export default App;
