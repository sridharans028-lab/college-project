CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS parcel_features (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    feature_type TEXT NOT NULL,
    confidence DOUBLE PRECISION,
    review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending','approved','rejected')),
    candidate_source TEXT,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    geom geometry(Geometry, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS parcel_features_geom_gix
    ON parcel_features USING GIST (geom);
CREATE INDEX IF NOT EXISTS parcel_features_review_idx
    ON parcel_features (review_status);
