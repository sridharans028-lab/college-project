import pg from 'pg'
const { Pool } = pg

const connectionString = process.env.DATABASE_URL
export const dbEnabled = Boolean(connectionString)
export const pool = dbEnabled ? new Pool({ connectionString, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined }) : null

export async function initDatabase() {
  if (!pool) {
    console.log('DATABASE_URL not set; using in-memory demo data. Configure PostGIS to persist features.')
    return
  }
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS parcel_features (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, feature_type TEXT NOT NULL,
      confidence DOUBLE PRECISION,
      review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending','approved','rejected')),
      candidate_source TEXT, properties JSONB NOT NULL DEFAULT '{}'::jsonb,
      geom geometry(Geometry,4326),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS parcel_features_geom_gix ON parcel_features USING GIST (geom)')
  console.log('PostGIS connected and schema is ready.')
}

export async function listDbFeatures() {
  const { rows } = await pool.query(`
    SELECT id, name, feature_type AS "featureType", confidence,
           review_status AS "reviewStatus", candidate_source AS "candidateSource",
           properties, ST_AsGeoJSON(geom)::json AS geometry
    FROM parcel_features ORDER BY updated_at DESC
  `)
  return rows.map(r => ({ type:'Feature', id:r.id, properties:{
    ...(r.properties || {}), id:r.id, name:r.name, featureType:r.featureType,
    confidence:r.confidence, reviewStatus:r.reviewStatus, candidateSource:r.candidateSource
  }, geometry:r.geometry }))
}

export async function upsertFeature(feature) {
  const p = feature.properties || {}
  const geom = feature.geometry ? JSON.stringify(feature.geometry) : null
  await pool.query(`
    INSERT INTO parcel_features
      (id,name,feature_type,confidence,review_status,candidate_source,properties,geom,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,
      CASE WHEN $8::jsonb IS NULL THEN NULL
           ELSE ST_SetSRID(ST_GeomFromGeoJSON($8::text),4326) END,NOW())
    ON CONFLICT (id) DO UPDATE SET
      name=EXCLUDED.name, feature_type=EXCLUDED.feature_type,
      confidence=EXCLUDED.confidence, review_status=EXCLUDED.review_status,
      candidate_source=EXCLUDED.candidate_source, properties=EXCLUDED.properties,
      geom=EXCLUDED.geom, updated_at=NOW()
  `, [
    String(p.id || feature.id || `feature-${Date.now()}`),
    String(p.name || 'Unnamed feature'), String(p.featureType || 'unknown'),
    Number.isFinite(Number(p.confidence)) ? Number(p.confidence) : null,
    ['pending','approved','rejected'].includes(p.reviewStatus) ? p.reviewStatus : 'pending',
    p.candidateSource || null, JSON.stringify(p), geom
  ])
}
