-- =========================================================================
-- AI-BASED ACCIDENT DETECTION & EMERGENCY RESPONSE SYSTEM
-- PRODUCTION POSTGRESQL SCHEMA DDL
-- Compatible with PostgreSQL 13+
-- =========================================================================

-- Enable UUID extension if required
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. USERS & ROLES TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER' NOT NULL, -- 'USER', 'ADMIN'
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL, -- 'ACTIVE', 'SUSPENDED'
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- -------------------------------------------------------------------------
-- 2. DEVICES & REGISTRATIONS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) UNIQUE NOT NULL,
    device_name VARCHAR(100) NOT NULL,
    device_type VARCHAR(50) NOT NULL, -- 'WRISTBAND', 'ESP32_CAM', 'MOBILE_CAMERA'
    owner_user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    connection_type VARCHAR(50) NOT NULL, -- 'BLE', 'WIFI', 'INTERNAL_PHONE'
    hardware_identifier VARCHAR(100), -- MAC address or serial
    pairing_code VARCHAR(50),
    registration_status VARCHAR(30) DEFAULT 'CLAIMED' NOT NULL, -- 'CLAIMED', 'PENDING'
    connection_status VARCHAR(30) DEFAULT 'DISCONNECTED' NOT NULL, -- 'CONNECTED', 'CONNECTING', 'DISCONNECTED', 'OFFLINE', 'ERROR'
    battery_level INT CHECK (battery_level >= 0 AND battery_level <= 100),
    last_bpm INT,
    last_latitude DOUBLE PRECISION,
    last_longitude DOUBLE PRECISION,
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(connection_status);

-- -------------------------------------------------------------------------
-- 3. NOTIFICATION TOKENS / APP INSTALLATIONS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    platform VARCHAR(20) DEFAULT 'ANDROID' NOT NULL, -- 'ANDROID', 'IOS', 'WEB'
    fcm_token VARCHAR(500) UNIQUE NOT NULL,
    device_name VARCHAR(100),
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_tokens_user ON notification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_tokens_token ON notification_tokens(fcm_token);

-- -------------------------------------------------------------------------
-- 4. INCIDENTS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    incident_id VARCHAR(50) UNIQUE NOT NULL,
    owner_user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    incident_type VARCHAR(50) NOT NULL, -- 'ROAD_ACCIDENT', 'FALL_ACCIDENT', 'FIRE_ACCIDENT', 'ABNORMAL_PULSE', 'MANUAL_SOS'
    status VARCHAR(30) DEFAULT 'ACTIVE' NOT NULL, -- 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'
    summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_incident_id ON incidents(incident_id);
CREATE INDEX IF NOT EXISTS idx_incidents_owner ON incidents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);

-- -------------------------------------------------------------------------
-- 5. DETECTION EVENTS TABLE (Idempotent Event Log)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detection_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) UNIQUE NOT NULL, -- IDEMPOTENCY KEY: e.g. 'EVENT-CAM-001-00028'
    incident_id VARCHAR(50) NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- 'ESP32_CAM', 'WRISTBAND', 'MOBILE_CAMERA'
    source_device_id VARCHAR(50) REFERENCES devices(device_id) ON DELETE SET NULL,
    image_url VARCHAR(500),
    bpm INT,
    confidence DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_accuracy DOUBLE PRECISION,
    location_status VARCHAR(50) DEFAULT 'AVAILABLE' NOT NULL, -- 'AVAILABLE', 'LOCATION UNAVAILABLE'
    alert_status VARCHAR(30) DEFAULT 'SENT' NOT NULL, -- 'SENT', 'PENDING', 'FAILED'
    detected_at TIMESTAMP NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_detection_events_event_id ON detection_events(event_id);
CREATE INDEX IF NOT EXISTS idx_detection_events_incident ON detection_events(incident_id);
CREATE INDEX IF NOT EXISTS idx_detection_events_source ON detection_events(source_type);

-- -------------------------------------------------------------------------
-- 6. INCIDENT MEDIA TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incident_media (
    id SERIAL PRIMARY KEY,
    incident_id VARCHAR(50) NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    event_id VARCHAR(100) REFERENCES detection_events(event_id) ON DELETE SET NULL,
    media_type VARCHAR(20) DEFAULT 'IMAGE' NOT NULL, -- 'IMAGE', 'VIDEO'
    file_url VARCHAR(500) NOT NULL,
    file_size INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_incident ON incident_media(incident_id);

-- -------------------------------------------------------------------------
-- 7. NOTIFICATION LOGS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    incident_id VARCHAR(50) NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    fcm_token VARCHAR(500) NOT NULL,
    status VARCHAR(30) NOT NULL, -- 'SUCCESS', 'FAILED', 'SIMULATED'
    response_payload TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_logs_incident ON notification_logs(incident_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_user ON notification_logs(user_id);

-- -------------------------------------------------------------------------
-- 8. AUDIT LOGS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
