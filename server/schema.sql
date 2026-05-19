-- ═══════════════════════════════════════════════════════════
--  Vybe / UniBuddy — PostgreSQL Schema
--  Paste this into Neon SQL Editor to create all tables
-- ═══════════════════════════════════════════════════════════

-- Users
CREATE TABLE IF NOT EXISTS users (
    id               BIGSERIAL PRIMARY KEY,
    email            TEXT UNIQUE NOT NULL,
    username         TEXT,
    college_domain   TEXT,
    gender           TEXT DEFAULT 'unspecified',
    city             TEXT,
    tier             TEXT DEFAULT 'free',
    tier_expires_at  TIMESTAMPTZ,
    abc_status       TEXT,
    abc_hash         TEXT,
    is_banned        BOOLEAN DEFAULT FALSE,
    is_shadow_banned BOOLEAN DEFAULT FALSE,
    last_seen_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Karma aggregate
CREATE TABLE IF NOT EXISTS karma (
    email          TEXT PRIMARY KEY,
    great          INT DEFAULT 0,
    okay           INT DEFAULT 0,
    disrespectful  INT DEFAULT 0,
    total          INT DEFAULT 0,
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Individual karma events
CREATE TABLE IF NOT EXISTS karma_events (
    id           BIGSERIAL PRIMARY KEY,
    rated_email  TEXT NOT NULL,
    rater_email  TEXT,
    rating       TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id              BIGSERIAL PRIMARY KEY,
    reported_email  TEXT NOT NULL,
    reporter_email  TEXT,
    reason          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id                   BIGSERIAL PRIMARY KEY,
    email                TEXT NOT NULL,
    plan                 TEXT NOT NULL,
    amount_paise         INT,
    razorpay_order_id    TEXT UNIQUE,
    razorpay_payment_id  TEXT,
    status               TEXT DEFAULT 'pending',
    starts_at            TIMESTAMPTZ,
    expires_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_karma_events_rated ON karma_events(rated_email);
CREATE INDEX IF NOT EXISTS idx_reports_reported   ON reports(reported_email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email);
