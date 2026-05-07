-- ═══════════════════════════════════════════════════════════
--  UniBuddy / RealTalk — Supabase PostgreSQL Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- ── Users ────────────────────────────────────────────────────
-- One row per verified college email. Created on first OTP verify.
CREATE TABLE IF NOT EXISTS users (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    username        TEXT NOT NULL,
    college_domain  TEXT,                          -- e.g. "iitb.ac.in"
    college_name    TEXT,                          -- e.g. "IIT Bombay"
    city            TEXT,                          -- for Plus tier city matching
    abc_status      TEXT DEFAULT 'none',           -- 'none' | 'pending' | 'verified'
    abc_hash        TEXT,                          -- SHA-256 of ABC ID, never raw
    tier            TEXT DEFAULT 'free',           -- 'free' | 'plus' | 'pro'
    tier_expires_at TIMESTAMPTZ,                   -- NULL = free (no expiry)
    is_banned       BOOLEAN DEFAULT false,
    is_shadow_banned BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    last_seen_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Karma ─────────────────────────────────────────────────────
-- Tied to email (not socketId) so it persists across sessions
CREATE TABLE IF NOT EXISTS karma (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    great           INT DEFAULT 0,
    okay            INT DEFAULT 0,
    disrespectful   INT DEFAULT 0,
    total           INT DEFAULT 0,                 -- great + okay + disrespectful
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Karma History ─────────────────────────────────────────────
-- Individual rating events for audit trail
CREATE TABLE IF NOT EXISTS karma_events (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rated_email     TEXT NOT NULL,                 -- who was rated
    rater_email     TEXT,                          -- who rated (NULL if guest)
    rating          TEXT NOT NULL CHECK (rating IN ('great', 'okay', 'disrespectful')),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Connect Requests ──────────────────────────────────────────
-- When two users mutually press "Connect" after a call
CREATE TABLE IF NOT EXISTS connects (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user1_email     TEXT NOT NULL,
    user2_email     TEXT NOT NULL,
    user1_accepted  BOOLEAN DEFAULT false,
    user2_accepted  BOOLEAN DEFAULT false,
    connected_at    TIMESTAMPTZ,                   -- set when both accept
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user1_email, user2_email)
);

-- ── Reports ───────────────────────────────────────────────────
-- User reports during/after calls
CREATE TABLE IF NOT EXISTS reports (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_email  TEXT,                          -- NULL if guest reporter
    reported_email  TEXT NOT NULL,
    reason          TEXT,                          -- optional free text
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Subscriptions ─────────────────────────────────────────────
-- Payment history and active subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email               TEXT NOT NULL REFERENCES users(email),
    plan                TEXT NOT NULL,             -- 'plus' | 'pro' | 'day_pass' | 'week_pass'
    amount_paise        INT,                       -- amount in paise (₹49 = 4900)
    razorpay_order_id   TEXT,
    razorpay_payment_id TEXT,
    status              TEXT DEFAULT 'pending',    -- 'pending' | 'active' | 'expired'
    starts_at           TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_college_domain ON users(college_domain);
CREATE INDEX IF NOT EXISTS idx_users_city           ON users(city);
CREATE INDEX IF NOT EXISTS idx_karma_email          ON karma(email);
CREATE INDEX IF NOT EXISTS idx_karma_events_rated   ON karma_events(rated_email);
CREATE INDEX IF NOT EXISTS idx_connects_user1       ON connects(user1_email);
CREATE INDEX IF NOT EXISTS idx_connects_user2       ON connects(user2_email);
CREATE INDEX IF NOT EXISTS idx_reports_reported     ON reports(reported_email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_email  ON subscriptions(email);

-- ── Row Level Security (RLS) ──────────────────────────────────
-- Server uses service_role key so it bypasses RLS automatically.
-- These policies protect direct client access (if ever added).
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE karma          ENABLE ROW LEVEL SECURITY;
ALTER TABLE karma_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE connects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions  ENABLE ROW LEVEL SECURITY;

-- Allow nobody by default (server uses service_role which bypasses RLS)
-- Add policies here if you ever add client-side Supabase access
