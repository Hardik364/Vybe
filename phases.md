# RealTalk — Build Phases tracker
> Step-by-step transformation of OmegleClone → RealTalk
> Check off tasks as they are completed ✅

---

## 🟢 PHASE 1 — UI/UX Redesign (Current Codebase)
> Goal: Make the existing app look and feel like RealTalk before adding any new features.
> No backend changes. Frontend only.

### 1.1 — Global Design System
- [ ] Add Google Fonts (Inter or DM Sans) to index.html
- [ ] Define CSS variables (colors, spacing, radius, shadows) in :root
- [ ] Replace all hardcoded hex colors with CSS variables
- [ ] Add dark theme base — background #0D0D0D, surface #1A1A1A, accent #6C63FF

### 1.2 — Signup Page Redesign
- [ ] Replace plain heading with RealTalk logo/wordmark
- [ ] Add tagline: "One stranger. Real talk. Your college."
- [ ] Redesign input field with floating label style
- [ ] Redesign submit button (gradient, rounded, hover animation)
- [ ] Add subtle background pattern or gradient

### 1.3 — Chat Page Layout Redesign
- [ ] Redesign top navbar (ConnectionStatusBar → full Navbar component)
  - [ ] Left: RealTalk wordmark
  - [ ] Center: Stranger name + online indicator dot
  - [ ] Right: 🎲 Prompts button + ⚙️ Settings icon
- [ ] Redesign video area — rounded corners, soft shadow, glassmorphism border
- [ ] Redesign message bubbles — better padding, font, colors
- [ ] Redesign input bar — pill-shaped input, icon buttons
- [ ] Add smooth transitions on all state changes

### 1.4 — Prompt Button + Prompt Card Component (UI only, no logic)
- [ ] Add 🎲 "Prompts" button to navbar (right side)
- [ ] Build PromptCard component (slides in from top of messageBox)
  - [ ] Category badge (Light / Deep / Debate / Nostalgic / Dreams)
  - [ ] Prompt text (large, centered)
  - [ ] "🔄 New Prompt" button
  - [ ] "✕ Close" button
- [ ] Add slide-in / slide-out CSS animation for PromptCard
- [ ] Mobile responsive: PromptCard full-width on small screens

### 1.5 — Connect / Move On Screen (UI only, no logic)
- [ ] Build PostCallScreen component (shown after call ends)
  - [ ] "The call has ended" heading
  - [ ] Two large buttons: Connect 🤝 and Move On 👋
  - [ ] Countdown timer (30s) for Connect window
- [ ] Add fade-in animation

### 1.6 — Mobile Responsiveness Pass
- [ ] Fix video layout on mobile (currently broken with visibility:hidden)
- [ ] Navbar collapses properly on small screens
- [ ] PromptCard full-width on mobile
- [ ] Input bar usable on mobile keyboard open

---

## 🟡 PHASE 2 — Prompt System (Feature)
> Goal: Prompt button works. Both users see the same prompt simultaneously.

### 2.1 — Prompt Data
- [ ] Create `client/src/data/prompts.json` with 150 prompts across 5 categories
  - [ ] Light & Fun (30)
  - [ ] Deep & Meaningful (30)
  - [ ] Debate & Opinion (30)
  - [ ] Nostalgic (30)
  - [ ] Dreams & Future (30)
- [ ] Add category colors and emoji to each category

### 2.2 — Server: Prompt Socket Events
- [ ] Add `requestPrompt` socket event in socketRoutes.js
  - Server picks random prompt from prompts.json
  - Emits `showPrompt` to BOTH users in the pair (sender + stranger)
- [ ] Add `dismissPrompt` socket event
  - Server emits `hidePrompt` to both users
- [ ] Add `nextPrompt` socket event (same as requestPrompt but guaranteed different prompt)

### 2.3 — Client: Prompt State + Logic
- [ ] Add `activePrompt` state in ChatPage.jsx
- [ ] Connect 🎲 button to emit `requestPrompt` via socket
- [ ] Listen for `showPrompt` event → set activePrompt state
- [ ] Listen for `hidePrompt` event → clear activePrompt state
- [ ] Pass activePrompt to PromptCard component
- [ ] PromptCard visible when activePrompt is not null

### 2.4 — Prompt Sync Test
- [ ] Open 2 browser tabs, connect as pair
- [ ] Click 🎲 in one tab → prompt appears in BOTH tabs simultaneously
- [ ] Click ✕ in one tab → closes in BOTH tabs
- [ ] Click 🔄 → new prompt appears in BOTH tabs

---

## 🟠 PHASE 3 — Core RealTalk Features
> Goal: Voice-first, live count, Connect/Move On logic, post-call karma rating.

### 3.1 — Voice-First Audio Stream
- [ ] Modify `openMediaStream.jsx` — default to audio only (`video: false`)
- [ ] Add "Enable Video 📹" button on call screen (both must consent)
- [ ] New socket event: `videoConsent` — server checks if both emitted → relays `videoEnabled`
- [ ] On `videoEnabled`: call `openMediaStream` with video, add track via `replaceTrack`

### 3.2 — Live Online Count
- [ ] Server: track connected users per college in Socket.IO rooms
- [ ] Emit `liveCount` event to all users in same room on every join/leave
- [ ] Client: show live count on home screen and in navbar ("👥 12 online")

### 3.3 — Connect / Move On Logic
- [ ] New socket events: `callEnded`, `connectRequest`, `moveOnRequest`
- [ ] Server: when user ends call → emit `callEnded` to both
- [ ] Server: track connect requests. If both within 30s → emit `contactsExchanged`
- [ ] Client: show PostCallScreen on `callEnded` event
- [ ] Client: handle 30s countdown UI

### 3.4 — Karma Rating System
- [ ] After call ends + Move On chosen: show rating modal (Great / Okay / Disrespectful)
- [ ] Server: store rating in Redis hash `karma:{socketId}`
- [ ] Server: calculate disrespectful % after each rating
- [ ] Server: if >20% → move to shadow ban queue `users:shadowban`

---

## 🔵 PHASE 4 — Authentication
> Goal: Real college student verification. Replace the fake username form.

### 4.1 — College Database
- [ ] Create `server/src/data/colleges.json` — list of Indian colleges + email domains
- [ ] API endpoint: `GET /api/colleges?q=search` → autocomplete search

### 4.2 — Signup Flow
- [ ] Redesign signup: College email input + College name autocomplete
- [ ] Server: validate email domain against colleges.json
- [ ] Server: send OTP via email (Nodemailer + Gmail SMTP or Resend.com)
- [ ] Client: OTP entry screen (6-digit code, 60s resend timer)
- [ ] Server: verify OTP → issue JWT token → store user in Redis

### 4.3 — Session Management
- [ ] Store JWT in httpOnly cookie or localStorage
- [ ] Socket.IO auth: send JWT instead of username
- [ ] Server middleware: verify JWT on every socket connection
- [ ] Auto-redirect to /chat if valid session exists

---

## 🔴 PHASE 5 — Safety System
> Goal: Platform is safe enough to show to real users.

### 5.1 — Report System
- [ ] Add Report button on call screen (flag icon)
- [ ] Socket event: `reportUser` → server logs to Redis sorted set
- [ ] After 3 unique reports → auto-suspend (blocked from connecting)
- [ ] Admin endpoint: `GET /admin/reports` (password protected)

### 5.2 — Shadow Ban Queue
- [ ] `processUserPairing()` checks if user is shadow-banned before queue assignment
- [ ] Shadow-banned users go to `users:shadowban:{collegeId}` queue
- [ ] Only match shadow-banned users with each other

### 5.3 — Banned Accounts
- [ ] Store banned college emails in Redis set `banned:emails`
- [ ] On signup: check against banned list → reject if found
- [ ] On socket connect: re-check ban status

---

## 🟣 PHASE 6 — Monetization
> Goal: First revenue. Day Pass + Monthly subscriptions working.

### 6.1 — Tier System
- [ ] User object gets `tier` field: `free | plus | pro`
- [ ] College-scoped Redis queues: `users:{collegeId}` / `users:city:{cityId}` / `users:global`
- [ ] `processUserPairing()` routes user to correct queue based on tier

### 6.2 — Razorpay Integration
- [ ] Razorpay account setup + API keys in .env
- [ ] Server: `POST /api/create-order` → Razorpay order
- [ ] Client: Razorpay checkout modal
- [ ] Server: `POST /api/verify-payment` → upgrade user tier in Redis
- [ ] Pricing: ₹19 Day Pass / ₹49 Week Pass / ₹49/mo Plus / ₹99/mo Pro

### 6.3 — Notify Me (Push Notifications)
- [ ] Register service worker in client
- [ ] Browser Push API: request permission on "Notify Me" click
- [ ] Server: store push subscription in Redis `waitlist:{collegeId}`
- [ ] When first user joins college queue → send push to all on waitlist

---

## ⬛ PHASE 7 — Production Hardening
> Goal: Ready to go live at one college.

- [ ] Add TURN server (Coturn on ₹500/mo VPS) to pcInstance.jsx ICE config
- [ ] Buy domain (realtalk.in) + point to server
- [ ] NGINX reverse proxy + SSL (Let's Encrypt)
- [ ] Rate limiting (express-rate-limit) on all socket events
- [ ] Remove all console.log — add pino logger
- [ ] Add /health endpoint for uptime monitoring
- [ ] Environment-based config (dev vs prod)
- [ ] Deploy client to Vercel
- [ ] Deploy server to Railway or Render

---

## 📊 PHASE SUMMARY

| Phase | Focus | Difficulty | Backend Changes | Est. Time |
|-------|-------|-----------|----------------|-----------|
| 1 | UI/UX Redesign | Easy | None | 1 week |
| 2 | Prompt System | Easy-Medium | Minor | 3 days |
| 3 | Core Features | Medium | Major | 1 week |
| 4 | Authentication | Hard | Major | 1 week |
| 5 | Safety | Medium | Medium | 4 days |
| 6 | Monetization | Hard | Major | 1 week |
| 7 | Production | Medium | Minor | 3 days |

> **Start with Phase 1 — no backend needed, pure UI. Ship something that looks real first.**
