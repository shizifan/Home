-- ============================================================
-- Home V1.0 PostgreSQL Initial Schema
-- Replaces MySQL 0001_init.sql + 0002_describe_card.sql + 0003_dual_image_source.sql
-- Target: PostgreSQL 15+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- users
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_phone    VARCHAR(20),
    child_nickname  VARCHAR(50),
    child_age       INT,
    consent_at      TIMESTAMPTZ,
    consent_version VARCHAR(20),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_users_age CHECK (child_age IS NULL OR (child_age >= 4 AND child_age <= 16))
);

-- ============================================================
-- companion_presets
-- ============================================================
CREATE TABLE companion_presets (
    preset_id           VARCHAR(50) PRIMARY KEY,
    display_name        VARCHAR(50) NOT NULL,
    appearance          TEXT,
    starting_personality TEXT,
    opening_line        TEXT,
    voice_traits        TEXT,
    ip_risk             BOOLEAN NOT NULL DEFAULT false,
    display_order       INT
);

-- ============================================================
-- companions
-- V1.0: +visit_count, +school_count, +plaza_count
-- V1.0: -last_panel_visit_at, -personality_weight
-- ============================================================
CREATE TABLE companions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preset_id           VARCHAR(50) NOT NULL,
    custom_name         VARCHAR(50),
    starting_personality TEXT,
    current_day         INT NOT NULL DEFAULT 1,
    visit_count         INT NOT NULL DEFAULT 0,
    school_count        INT NOT NULL DEFAULT 0,
    plaza_count         INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    graduated_at        TIMESTAMPTZ,

    CONSTRAINT chk_companions_day CHECK (current_day >= 1 AND current_day <= 7)
);

CREATE INDEX idx_companions_user ON companions(user_id);

-- ============================================================
-- memories
-- V1.0: +description_text, +user_choice
-- V1.0: photo_url/vision_tags retained for V0.5 history (nullable)
-- ============================================================
CREATE TABLE memories (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id      UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    day               INT NOT NULL,
    type              VARCHAR(20) NOT NULL,
    photo_url         TEXT,
    vision_tags       JSONB,
    user_text         TEXT,
    description_text  TEXT,
    user_choice       JSONB,
    input_method      VARCHAR(20) NOT NULL DEFAULT 'photo',
    voice_audio_url   TEXT,
    asr_transcription TEXT,
    edited_text       TEXT,
    task_id           VARCHAR(50),
    task_question     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_memories_type CHECK (type IN ('photo','text','choice','skipped','voice','describe')),
    CONSTRAINT chk_memories_day CHECK (day >= 1 AND day <= 7),
    CONSTRAINT chk_memories_input_method CHECK (input_method IN ('photo','voice','text','choice','skipped','describe'))
);

CREATE INDEX idx_memories_companion_day ON memories(companion_id, day);
CREATE INDEX idx_memories_created ON memories(created_at);

-- ============================================================
-- memory_bank
-- V1.0: +source_type, +source_companion_id
-- V1.0: -cached_detail, -cache_dirty, -display_order
-- ============================================================
CREATE TABLE memory_bank (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id             UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    type                     VARCHAR(20) NOT NULL,
    concept_name             VARCHAR(100),
    concept_category         VARCHAR(20),
    ai_summary               TEXT,
    ai_reasoning             TEXT,
    evidence                 JSONB,
    confidence               REAL NOT NULL DEFAULT 0.5,
    source_type              VARCHAR(20) NOT NULL DEFAULT 'direct',
    source_companion_id      UUID,
    user_corrected           BOOLEAN NOT NULL DEFAULT false,
    user_correction_history  JSONB,
    last_updated             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_memory_bank_type CHECK (type IN ('remembered','uncertain','set_aside','unknown')),
    CONSTRAINT chk_memory_bank_category CHECK (
        concept_category IN ('person','place','food','activity','object','emotion','other')
    ),
    CONSTRAINT chk_memory_bank_conf CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT chk_memory_bank_source CHECK (source_type IN ('direct','secondhand')),
    CONSTRAINT uk_memory_bank_remembered UNIQUE (companion_id, concept_name, type)
);

CREATE INDEX idx_memory_bank_companion ON memory_bank(companion_id);

-- ============================================================
-- conversations
-- ============================================================
CREATE TABLE conversations (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id           UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    day                    INT,
    role                   VARCHAR(20) NOT NULL,
    content                TEXT NOT NULL,
    source                 VARCHAR(50),
    related_memory_id      UUID REFERENCES memories(id) ON DELETE SET NULL,
    related_memory_bank_id UUID REFERENCES memory_bank(id) ON DELETE SET NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_conversations_role CHECK (role IN ('companion','child','system'))
);

CREATE INDEX idx_conversations_companion_day ON conversations(companion_id, day);

-- ============================================================
-- cards (description cards)
-- V1.0: image_source/alt_image_url/alt_image_source always null (serial gen)
-- V1.0: +content_audit_passed, +content_audit_labels
-- ============================================================
CREATE TABLE cards (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id             UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    companion_id          UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    image_url             TEXT,
    image_source          VARCHAR(20),
    alt_image_url         TEXT,
    alt_image_source      VARCHAR(20),
    image_prompt          TEXT,
    raw_keyword_extract   JSONB,
    style_check_passed    BOOLEAN,
    style_check_severity  VARCHAR(20),
    style_check_issues    JSONB,
    content_audit_passed  BOOLEAN,
    content_audit_labels  JSONB,
    generation_attempt    INT NOT NULL DEFAULT 1,
    is_active             BOOLEAN NOT NULL DEFAULT false,
    is_fallback_text_card BOOLEAN NOT NULL DEFAULT false,
    child_action          VARCHAR(20),
    confirmed_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_cards_attempt CHECK (generation_attempt >= 1 AND generation_attempt <= 4),
    CONSTRAINT chk_cards_severity CHECK (style_check_severity IN ('ok','minor','major')),
    CONSTRAINT chk_cards_action CHECK (child_action IN ('confirmed','rejected','no_action_timeout'))
);

CREATE INDEX idx_cards_memory ON cards(memory_id);
CREATE INDEX idx_cards_active ON cards(companion_id, is_active);
CREATE INDEX idx_cards_companion ON cards(companion_id);

-- ============================================================
-- worldview_cards
-- ============================================================
CREATE TABLE worldview_cards (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id          UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    most_important_person TEXT,
    most_fun_thing        TEXT,
    most_delicious_thing  TEXT,
    most_scary_thing      TEXT,
    unknown_thing         TEXT,
    almost_forgot_thing   TEXT,
    stats                 JSONB,
    generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_llm_output        JSONB
);

-- ============================================================
-- trips (station outings) — V1.0 NEW
-- ============================================================
CREATE TABLE trips (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id             UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    trip_type                VARCHAR(20) NOT NULL,
    destination_companion_id UUID,
    purpose_type             VARCHAR(50),
    purpose_question         TEXT,
    plaza_play_id            UUID,
    status                   VARCHAR(20) NOT NULL DEFAULT 'traveling',
    departed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    returned_at              TIMESTAMPTZ,
    report_narrative         TEXT,
    report_data              JSONB,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_trips_type CHECK (trip_type IN ('visit','school','plaza')),
    CONSTRAINT chk_trips_status CHECK (status IN ('traveling','returned'))
);

CREATE INDEX idx_trips_companion ON trips(companion_id);
CREATE INDEX idx_trips_status ON trips(companion_id, status);

-- ============================================================
-- inventory_items (backpack) — V1.0 NEW
-- ============================================================
CREATE TABLE inventory_items (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id             UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    item_id                  VARCHAR(50) NOT NULL,
    item_name                VARCHAR(100) NOT NULL,
    item_category            VARCHAR(20) NOT NULL,
    item_subcategory         VARCHAR(50),
    item_description         TEXT,
    item_detailed_description TEXT,
    acquired_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    acquired_from            VARCHAR(100),
    use_count                INT NOT NULL DEFAULT 0,
    last_used_at             TIMESTAMPTZ,
    is_upgraded_from         UUID REFERENCES inventory_items(id) ON DELETE SET NULL,

    CONSTRAINT chk_inventory_category CHECK (item_category IN ('knowledge','object','gift','ability'))
);

CREATE INDEX idx_inventory_companion ON inventory_items(companion_id);

-- ============================================================
-- plaza_plays — V1.0 NEW
-- ============================================================
CREATE TABLE plaza_plays (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companion_id    UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    trip_id         UUID REFERENCES trips(id) ON DELETE SET NULL,
    scenario_id     VARCHAR(50) NOT NULL,
    scenario_title  VARCHAR(100),
    act_choices     JSONB,
    ending_type     VARCHAR(20),
    ending_narrative TEXT,
    earned_items    JSONB,
    played_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,

    CONSTRAINT chk_plaza_ending CHECK (ending_type IN ('perfect','good','barely'))
);

CREATE INDEX idx_plaza_plays_companion ON plaza_plays(companion_id);

-- ============================================================
-- llm_call_log
-- ============================================================
CREATE TABLE llm_call_log (
    id             BIGSERIAL PRIMARY KEY,
    companion_id   UUID REFERENCES companions(id) ON DELETE SET NULL,
    call_type      VARCHAR(50) NOT NULL,
    model          VARCHAR(100),
    input_tokens   INT,
    output_tokens  INT,
    latency_ms     INT,
    success        BOOLEAN NOT NULL DEFAULT true,
    fail_reason    VARCHAR(200),
    prompt_version VARCHAR(50),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_llm_call_log_type_time ON llm_call_log(call_type, created_at);

-- ============================================================
-- companion_stats view
-- ============================================================
CREATE VIEW companion_stats AS
SELECT
    c.id AS companion_id,
    COUNT(DISTINCT m.id) FILTER (WHERE m.type = 'photo') AS photos,
    COUNT(DISTINCT conv.id) AS conversations_count,
    COUNT(DISTINCT mb.id) FILTER (WHERE mb.user_corrected = true) AS corrections,
    c.current_day
FROM companions c
LEFT JOIN memories m ON m.companion_id = c.id
LEFT JOIN conversations conv ON conv.companion_id = c.id
LEFT JOIN memory_bank mb ON mb.companion_id = c.id
GROUP BY c.id;
