# RealTalk — UI/UX Design Specification
> Complete design guide for every screen, component, and interaction.
> Every pixel decision is documented here. Build from this file.

---

## 🎨 DESIGN SYSTEM

### Color Palette
```
--bg-primary:      #0D0D0D    /* Main background — deep black */
--bg-surface:      #1A1A1A    /* Cards, panels */
--bg-elevated:     #242424    /* Input fields, hover states */
--accent-purple:   #6C63FF    /* Primary CTA, active states */
--accent-green:    #22C55E    /* Success, Connect button, "online" dot */
--accent-red:      #EF4444    /* Danger, Move On, report */
--accent-amber:    #F59E0B    /* Warnings, karma "okay" */
--text-primary:    #FFFFFF    /* Main text */
--text-secondary:  #A0A0A0    /* Subtitles, placeholders */
--text-muted:      #555555    /* Disabled, hints */
--border:          #2A2A2A    /* Borders, dividers */
--shadow:          rgba(0,0,0,0.4)
```

### Typography
```
Font Family: 'Inter', sans-serif (add to index.html via Google Fonts)
Weights used: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

Scale:
--text-xs:   11px
--text-sm:   13px
--text-base: 15px
--text-lg:   18px
--text-xl:   22px
--text-2xl:  28px
--text-3xl:  36px
```

### Spacing & Radius
```
--radius-sm:  6px
--radius-md:  12px
--radius-lg:  20px
--radius-xl:  32px
--radius-full: 9999px

Spacing scale: 4px base unit (4, 8, 12, 16, 20, 24, 32, 48, 64)
```

### Shadows
```
--shadow-sm:  0 1px 3px rgba(0,0,0,0.3)
--shadow-md:  0 4px 16px rgba(0,0,0,0.4)
--shadow-lg:  0 8px 32px rgba(0,0,0,0.5)
--shadow-accent: 0 0 20px rgba(108,99,255,0.3)
```

### Animations
```
--transition-fast:   150ms ease
--transition-base:   250ms ease
--transition-slow:   400ms ease

Easing for modals/cards: cubic-bezier(0.34, 1.56, 0.64, 1)  /* spring bounce */
```

---

## 📱 SCREEN 1 — SIGNUP PAGE

### Layout
```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│           ✦  RealTalk                   │  ← Logo/wordmark, --accent-purple, 36px bold
│                                         │
│   One stranger. Real talk. Your         │  ← Tagline, --text-secondary, 15px
│   college.                              │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  📧  Your college email         │   │  ← Input field
│   └─────────────────────────────────┘   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │         Start Talking →         │   │  ← CTA button
│   └─────────────────────────────────┘   │
│                                         │
│   By joining you agree to our Terms     │  ← Fine print, --text-muted, 11px
│                                         │
└─────────────────────────────────────────┘
```

### Component Details

**Logo**
- Text: "RealTalk" in bold 36px Inter
- Color: linear-gradient(135deg, #6C63FF, #A78BFA)
- Add a small ✦ spark icon before it
- Letter spacing: -0.5px

**Tagline**
- "One stranger. Real talk. Your college."
- Color: --text-secondary
- Font size: 15px, weight 400
- Margin bottom: 40px

**Email Input Field**
```css
background: #1A1A1A;
border: 1.5px solid #2A2A2A;
border-radius: 12px;
padding: 14px 16px;
font-size: 15px;
color: #fff;
width: 100%;
max-width: 360px;
transition: border-color 250ms ease;

/* Focus state */
border-color: #6C63FF;
box-shadow: 0 0 0 3px rgba(108,99,255,0.15);
```
- Placeholder: "your.name@college.edu.in"
- Left icon: 📧 email icon (SVG, --text-muted)

**Submit Button**
```css
background: linear-gradient(135deg, #6C63FF, #8B5CF6);
color: white;
border: none;
border-radius: 12px;
padding: 14px 24px;
font-size: 15px;
font-weight: 600;
width: 100%;
max-width: 360px;
cursor: pointer;
transition: transform 150ms ease, box-shadow 150ms ease;

/* Hover */
transform: translateY(-1px);
box-shadow: 0 8px 24px rgba(108,99,255,0.4);

/* Active */
transform: translateY(0px);
```

**Background**
- Solid #0D0D0D
- Subtle radial gradient at top: `radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.08) 0%, transparent 70%)`
- Page is centered both horizontally and vertically

---

## 📱 SCREEN 2 — CHAT PAGE (Main App)

### Layout (Desktop — above 768px)
```
┌──────────────────────────────────────────────────────────────────────┐
│  ✦ RealTalk          ● Ayesha Khan              🎲 Prompts  ⚙️      │  ← NAVBAR
├─────────────────────────┬────────────────────────────────────────────┤
│                         │                                            │
│  ┌───────────────────┐  │  ┌──────────────────────────────────────┐ │
│  │                   │  │  │  💬 What's one thing you'd tell      │ │  ← PROMPT CARD
│  │   REMOTE VIDEO    │  │  │  your 15-year-old self?         [✕] │ │     (slides in)
│  │   (stranger)      │  │  │  [🔄 New Prompt]    [Light & Fun 🌟] │ │
│  │                   │  │  └──────────────────────────────────────┘ │
│  └───────────────────┘  │                                            │
│                         │  ┌──────────────────────────────────────┐ │
│  ┌───────────────────┐  │  │                                      │ │
│  │                   │  │  │         MESSAGE BOX                  │ │
│  │   LOCAL VIDEO     │  │  │                                      │ │
│  │   (you)           │  │  │   Ayesha: hey what's up!            │ │
│  │                   │  │  │                     you: haha hey 👋 │ │
│  └───────────────────┘  │  │                                      │ │
│                         │  └──────────────────────────────────────┘ │
│                         │                                            │
│                         │  ┌──────────────────────────────────────┐ │
│                         │  │ [New] [    Type a message...   ][Send]│ │  ← INPUT BAR
│                         │  └──────────────────────────────────────┘ │
└─────────────────────────┴────────────────────────────────────────────┘
```

### Layout (Mobile — below 768px)
```
┌──────────────────────────────────────┐
│  ✦ RealTalk    ● Ayesha    🎲  ⚙️  │  ← Compact navbar
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │       REMOTE VIDEO             │  │  ← Full width, 35vh
│  │                      ┌──────┐  │  │
│  │                      │LOCAL │  │  │  ← PiP local video (top right)
│  │                      └──────┘  │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │  ← Prompt card (when active)
│  │ 💬 What's one thing...   [✕] │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │     MESSAGE BOX                │  │  ← Grows to fill remaining space
│  │                                │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │[New][    Message...      ][→]  │  │  ← Input bar
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## 🔧 COMPONENT 1 — NAVBAR

```
[✦ RealTalk]          [● Ayesha Khan  👥 12 online]          [🎲] [⚙️]
```

**Specs:**
```css
#navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: rgba(26,26,26,0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #2A2A2A;
  position: sticky;
  top: 0;
  z-index: 100;
}
```

**Left — Wordmark**
- "✦ RealTalk" — gradient text, 18px, bold
- Clickable → returns to home (shows warning if in call)

**Center — Stranger Info**
- Green dot (8px circle, #22C55E, pulse animation) + stranger username
- Below: "👥 12 from your college online" in --text-muted, 12px
- When searching: replace with spinning loader + "Finding your match..."

**Right — Action Icons**
- 🎲 Prompts button:
  ```css
  background: rgba(108,99,255,0.15);
  border: 1px solid rgba(108,99,255,0.3);
  color: #6C63FF;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  ```
  - Hover: background darkens, slight scale(1.02)
  - Active (prompt shown): background #6C63FF, color white
- ⚙️ Settings icon — opens settings modal (camera, audio, etc.)

**Online Dot Pulse Animation:**
```css
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(1.3); }
}
.online-dot {
  animation: pulse 2s ease infinite;
}
```

---

## 🔧 COMPONENT 2 — VIDEO AREA

**Remote Video**
```css
#remoteVideo {
  width: 100%;
  height: 47vh;
  background: #1A1A1A;
  border-radius: 16px;
  object-fit: cover;
  border: 1px solid #2A2A2A;
  /* When no stream: */
  /* display gradient placeholder with avatar icon */
}
```

**No Stream Placeholder (while searching):**
```
┌───────────────────────────┐
│                           │
│        👤                 │  ← Large avatar icon, --text-muted
│   Waiting for match...    │
│                           │
└───────────────────────────┘
```

**Local Video**
```css
#localVideo {
  width: 100%;
  height: 47vh;
  background: #1A1A1A;
  border-radius: 16px;
  object-fit: cover;
  border: 1px solid #2A2A2A;
  margin-top: 8px;
  cursor: pointer; /* click to change camera */
}
```

**Camera icon overlay on hover (localVideo):**
```
[🎥 Change Camera]  ← appears on hover, semi-transparent overlay
```

---

## 🔧 COMPONENT 3 — PROMPT CARD

### Closed State (hidden)
- Nothing visible. Just the 🎲 button in navbar.

### Open State — Slides in from top of messageBox
```
┌─────────────────────────────────────────────────────────┐
│  🌟 Light & Fun              [🔄 New]            [✕]   │
│                                                         │
│   "What's one decision you've never regretted?"         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**CSS:**
```css
#promptCard {
  background: linear-gradient(135deg, rgba(108,99,255,0.12), rgba(139,92,246,0.08));
  border: 1px solid rgba(108,99,255,0.25);
  border-radius: 16px;
  padding: 16px 20px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  /* Animation */
  animation: slideDown 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-20px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

**Header Row:**
- Left: Category badge `[🌟 Light & Fun]`
  ```css
  background: rgba(245,158,11,0.15);
  border: 1px solid rgba(245,158,11,0.3);
  color: #F59E0B;
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  ```
- Right: `[🔄]` (new prompt) and `[✕]` (close) icon buttons

**Prompt Text:**
- Font size: 16px, weight 500
- Color: --text-primary
- Line height: 1.5
- Max 2 lines, ellipsis if longer

**Category → Color Mapping:**
```
Light & Fun       → amber   (#F59E0B)
Deep & Meaningful → purple  (#6C63FF)
Debate & Opinion  → blue    (#3B82F6)
Nostalgic         → pink    (#EC4899)
Dreams & Future   → green   (#22C55E)
```

---

## 🔧 COMPONENT 4 — MESSAGE BOX

```css
#messageBox {
  flex-grow: 1;
  overflow-y: auto;
  padding: 16px;
  background: #111111;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scroll-behavior: smooth;

  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: #2A2A2A transparent;
}
```

**Message Bubbles:**
```css
/* Sent (right) */
.right {
  align-self: flex-end;
  background: #6C63FF;
  color: white;
  border-radius: 18px 18px 4px 18px;
  padding: 10px 16px;
  max-width: 75%;
  font-size: 14px;
  line-height: 1.5;
}

/* Received (left) */
.left {
  align-self: flex-start;
  background: #242424;
  color: white;
  border-radius: 18px 18px 18px 4px;
  padding: 10px 16px;
  max-width: 75%;
  font-size: 14px;
  line-height: 1.5;
}
```

**Overlay Status (center of messageBox when no messages):**
```
┌──────────────────────────────────┐
│                                  │
│    ✦ You and Ayesha are          │
│      connected!                  │
│    Say hi 👋                     │
│                                  │
└──────────────────────────────────┘
```
```css
#overlayStatus {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: --text-muted;
  font-size: 14px;
  text-align: center;
}
```

---

## 🔧 COMPONENT 5 — INPUT BAR

```
┌────────────────────────────────────────────────────┐
│ [New ↩]   [Type a message...                ] [→] │
└────────────────────────────────────────────────────┘
```

**Container:**
```css
#inputBar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #1A1A1A;
  border-radius: 16px;
  border: 1px solid #2A2A2A;
}
```

**New Button:**
```css
#changeNewUser {
  background: transparent;
  border: 1px solid #2A2A2A;
  color: --text-secondary;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 150ms ease;
}

#changeNewUser:hover {
  border-color: #EF4444;
  color: #EF4444;
  background: rgba(239,68,68,0.08);
}
```

**Text Input:**
```css
#sendMessageBox {
  flex-grow: 1;
  background: transparent;
  border: none;
  outline: none;
  color: white;
  font-size: 14px;
  padding: 8px 4px;
  font-family: 'Inter', sans-serif;
}
#sendMessageBox::placeholder { color: #555; }
```

**Send Button:**
```css
#sendBtn {
  background: #6C63FF;
  border: none;
  border-radius: 10px;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
  flex-shrink: 0;
}
#sendBtn:hover {
  background: #5B52E8;
  transform: scale(1.05);
}
/* Icon: → arrow SVG, white, 18px */
```

---

## 🔧 COMPONENT 6 — POST CALL SCREEN

### When either user ends the call or partner disconnects:
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              The call has ended.                     │  ← --text-secondary, 14px
│                                                      │
│          ✨ You just talked to Ayesha                │  ← --text-primary, 18px bold
│                                                      │
│   ┌──────────────────┐    ┌──────────────────┐      │
│   │   Connect  🤝    │    │  Move On  👋     │      │
│   │                  │    │                  │      │
│   │  Swap contacts   │    │ Gone forever     │      │
│   │  if she connects │    │                  │      │
│   │  too (28s)       │    │                  │      │
│   └──────────────────┘    └──────────────────┘      │
│                                                      │
│   ● Research shows your match liked the              │  ← "Liking Gap" nudge
│     conversation more than you think                 │    --text-muted, 12px
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Connect Button:**
```css
.post-call-connect {
  background: linear-gradient(135deg, #22C55E, #16A34A);
  color: white;
  border: none;
  border-radius: 16px;
  padding: 20px 28px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  flex: 1;
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.post-call-connect:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(34,197,94,0.35);
}
```

**Move On Button:**
```css
.post-call-moveon {
  background: transparent;
  color: --text-secondary;
  border: 1.5px solid #2A2A2A;
  border-radius: 16px;
  padding: 20px 28px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  flex: 1;
  transition: all 150ms ease;
}
.post-call-moveon:hover {
  border-color: #EF4444;
  color: #EF4444;
  background: rgba(239,68,68,0.06);
}
```

**Timer on Connect button:**
- Live countdown: "28s" updating every second
- When timer hits 0 → Move On automatically, button dims

**After both Connect:**
```
┌──────────────────────────────────┐
│      🎉 You're both connected!   │
│                                  │
│   Share your contact:            │
│   [ WhatsApp ] [ Instagram ]     │
│                                  │
│   Or: Let the app share for you  │
│   [Share contact automatically]  │
└──────────────────────────────────┘
```

---

## 🔧 COMPONENT 7 — KARMA RATING MODAL

### Shown after Move On (or after Connect flow completes)
```
┌──────────────────────────────────────┐
│                                      │
│   How was your conversation?         │  ← 16px semibold
│   (Anonymous — Ayesha won't know)    │  ← 12px --text-muted
│                                      │
│  ┌──────────┐ ┌─────────┐ ┌──────┐  │
│  │ 😊 Great │ │ 😐 Okay │ │😠 !! │  │  ← 3 big tap targets
│  └──────────┘ └─────────┘ └──────┘  │
│                                      │
│              [Skip]                  │  ← --text-muted, small
└──────────────────────────────────────┘
```

**Modal appearance:**
```css
#karmaModal {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #1A1A1A;
  border-radius: 24px 24px 0 0;
  padding: 24px;
  border-top: 1px solid #2A2A2A;
  animation: slideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 200;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
```

**Rating Buttons:**
```css
.karma-btn {
  flex: 1;
  background: #242424;
  border: 1.5px solid #2A2A2A;
  border-radius: 14px;
  padding: 16px 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: all 150ms ease;
}

/* Great */
.karma-great:hover { border-color: #22C55E; background: rgba(34,197,94,0.1); color: #22C55E; }
/* Okay */
.karma-okay:hover  { border-color: #F59E0B; background: rgba(245,158,11,0.1); color: #F59E0B; }
/* Disrespectful */
.karma-bad:hover   { border-color: #EF4444; background: rgba(239,68,68,0.1);  color: #EF4444; }
```

---

## 🔧 COMPONENT 8 — LIVE COUNT BADGE (Navbar)

```
● 12 online
```
```css
.live-count {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #A0A0A0;
  background: #1A1A1A;
  border: 1px solid #2A2A2A;
  border-radius: 20px;
  padding: 4px 10px;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22C55E;
  animation: pulse 2s infinite;
}
```

---

## 📐 LAYOUT GRID SPEC

### Desktop (>768px)
```
Viewport:    100vw × 100vh
Navbar:      100% × 56px
Content:     calc(100vh - 56px)

Left panel (video):   38% width
Right panel (chat):   62% width
Gap between panels:   12px
Outer padding:        12px all sides
```

### Mobile (≤768px)
```
Navbar:      100% × 48px
Video area:  100% × 35vh
Prompt card: 100% × auto (visible above chat)
Chat area:   100% × remaining height
Input bar:   100% × 56px (fixed to bottom)
```

---

## 🎬 INTERACTION FLOWS

### Flow 1 — Prompt Feature
```
User clicks [🎲 Prompts]
    ↓
Button turns solid purple (active state)
Socket emits → requestPrompt
    ↓
Server picks random prompt, emits showPrompt to both users
    ↓
PromptCard animates in (slideDown) at top of messageBox
Both users see identical card simultaneously
    ↓
User A clicks [🔄 New Prompt]
Socket emits → nextPrompt
Both see new prompt animate in
    ↓
User B clicks [✕]
Socket emits → dismissPrompt
Card animates out on BOTH screens
🎲 button returns to outline style
```

### Flow 2 — End of Call
```
User clicks [New ↩] or partner disconnects
    ↓
PostCallScreen fades in (full overlay)
30-second countdown begins on Connect button
    ↓
User taps [Connect 🤝]
Server stores connect intent, waits for other user
    ↓
If other user also taps Connect within 30s:
  → 🎉 "You're both connected!" screen
  → Contact sharing options appear

If 30s passes or other user taps Move On:
  → Karma rating modal slides up
  → After rating: matchmaking restarts automatically
```

### Flow 3 — Searching for Match
```
Loading state in navbar center:
"Finding your match..." + spinner
    ↓
Remote video shows placeholder (grey + avatar icon)
    ↓
Match found → navbar center shows:
● Ayesha Khan (green dot fades in)
Remote video fills with stranger's stream
PromptCard auto-shows first prompt (optional per settings)
```

---

## 📂 FILE STRUCTURE AFTER PHASE 1

```
client/src/
├── components/
│   ├── App.jsx
│   ├── ChatPage.jsx          (updated — new layout)
│   └── SignUp.jsx            (renamed from SingUp.jsx, redesigned)
├── assets/
│   ├── videoCall/
│   │   ├── localVideo.jsx
│   │   ├── remoteVideo.jsx
│   │   └── changeCam.jsx
│   ├── messaging/
│   │   ├── messageBox.jsx    (updated styles)
│   │   ├── inputBox.jsx      (updated — new design)
│   │   └── connectionStatusBar.jsx → REPLACED by:
│   └── ui/                   ← NEW FOLDER
│       ├── Navbar.jsx        (new — replaces connectionStatusBar)
│       ├── PromptCard.jsx    (new)
│       ├── PostCallScreen.jsx (new)
│       ├── KarmaModal.jsx    (new)
│       └── LiveCountBadge.jsx (new)
├── data/
│   └── prompts.json          (new — 150 prompts)
├── hooks/
│   ├── useSocket.jsx
│   └── usePeerConnection.jsx
├── utils/
│   ├── webrtc-singaling.jsx
│   ├── openMediaStream.jsx
│   ├── startWebRtcNegotiation.jsx
│   ├── changeCamUtils.jsx
│   └── pcInstance.jsx
└── style/
    └── index.css             (updated — full design system)
```

---

> **Build Phase 1 first. Get the UI looking like RealTalk before any logic changes.**
> **Every component above has enough detail to code directly from this file.**
