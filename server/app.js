import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dbEnabled, initDatabase, pool, listDbFeatures, upsertFeature } from './db.js'

dotenv.config()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 5000
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'
const uploadDir = path.join(__dirname, 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })
app.use(cors({ origin: true }))
app.use(express.json({ limit: '15mb' }))

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
})
const upload = multer({
  storage,
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 25) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp','image/tiff','application/octet-stream']
    cb(allowed.includes(file.mimetype) ? null : new Error('Unsupported file type. Upload PNG, JPG, WEBP or TIFF.'), allowed.includes(file.mimetype))
  }
})

const sampleFeatures = [
  {type:'Feature',id:'P-001',properties:{id:'P-001',name:'Sample Parcel 001',featureType:'parcel',confidence:92,reviewStatus:'pending'},geometry:{type:'Polygon',coordinates:[[[80.2688,13.0832],[80.2700,13.0832],[80.2700,13.0840],[80.2688,13.0840],[80.2688,13.0832]]]}},
  {type:'Feature',id:'B-001',properties:{id:'B-001',name:'Sample Building 001',featureType:'building',confidence:96,reviewStatus:'pending'},geometry:{type:'Polygon',coordinates:[[[80.2690,13.08335],[80.26935,13.08335],[80.26935,13.08365],[80.2690,13.08365],[80.2690,13.08335]]]}},
  {type:'Feature',id:'B-002',properties:{id:'B-002',name:'Sample Building 002',featureType:'building',confidence:89,reviewStatus:'pending'},geometry:{type:'Polygon',coordinates:[[[80.26955,13.0835],[80.26982,13.0835],[80.26982,13.08375],[80.26955,13.08375],[80.26955,13.0835]]]}}
]
let memoryFeatures = [...sampleFeatures]

app.get('/api/health', (_req, res) => res.json({status:'ok',service:'urban-parcel-api',database:dbEnabled?'postgis':'in-memory-demo',aiService:AI_SERVICE_URL}))
app.get('/api/parcels', async (_req, res, next) => {
  try { res.json(dbEnabled ? await listDbFeatures() : memoryFeatures) } catch (e) { next(e) }
})
app.get('/api/geojson', async (_req, res, next) => {
  try { res.json({type:'FeatureCollection',features:dbEnabled ? await listDbFeatures() : memoryFeatures}) } catch (e) { next(e) }
})
app.get('/api/stats', async (_req, res, next) => {
  try {
    const features = dbEnabled ? await listDbFeatures() : memoryFeatures
    const count = (predicate) => features.filter(predicate).length
    res.json({
      totalFeatures:features.length,
      buildings:count(f=>f.properties?.featureType==='building'),
      parcelCandidates:count(f=>f.properties?.featureType==='parcel'),
      roads:count(f=>f.properties?.featureType==='road'),
      pending:count(f=>f.properties?.reviewStatus==='pending' || f.properties?.reviewStatus==='needs_review'),
      approved:count(f=>f.properties?.reviewStatus==='approved'),
      rejected:count(f=>f.properties?.reviewStatus==='rejected'),
      storage:dbEnabled?'PostgreSQL + PostGIS':'In-memory demo (not persistent)'
    })
  } catch (e) { next(e) }
})
app.put('/api/parcels/:id', async (req, res, next) => {
  try {
    const { feature } = req.body || {}
    if (!feature || !feature.geometry || !feature.properties) return res.status(400).json({error:'A GeoJSON feature with geometry and properties is required.'})
    feature.properties.id = String(req.params.id)
    if (!['pending','approved','rejected'].includes(feature.properties.reviewStatus)) return res.status(400).json({error:'Invalid review status.'})
    if (dbEnabled) await upsertFeature(feature)
    else {
      const index = memoryFeatures.findIndex(f => String(f.properties?.id || f.id) === String(req.params.id))
      if (index >= 0) memoryFeatures[index] = feature
      else memoryFeatures.push(feature)
    }
    res.json({status:'saved',persistent:dbEnabled,feature})
  } catch (e) { next(e) }
})
app.post('/api/parcels/bulk', async (req, res, next) => {
  try {
    const features = req.body?.features
    if (!Array.isArray(features)) return res.status(400).json({error:'features must be an array'})
    if (dbEnabled) {
      const client = await pool.connect()
      try { await client.query('BEGIN'); for (const feature of features) await upsertFeature(feature); await client.query('COMMIT') }
      catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
    } else {
      for (const feature of features) {
        const id = String(feature.properties?.id || feature.id || `feature-${Date.now()}-${Math.random()}`)
        feature.properties = {...feature.properties, id}
        const index = memoryFeatures.findIndex(f => String(f.properties?.id || f.id) === id)
        if (index >= 0) memoryFeatures[index] = feature; else memoryFeatures.push(feature)
      }
    }
    res.json({status:'saved',count:features.length,persistent:dbEnabled})
  } catch (e) { next(e) }
})
app.post('/api/analysis', upload.single('image'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({error:'Please upload an image.'})
  try {
    const form = new FormData()
    const bytes = fs.readFileSync(req.file.path)
    form.append('image', new Blob([bytes], {type:req.file.mimetype}), req.file.originalname)
    const response = await fetch(`${AI_SERVICE_URL}/analyze`, {method:'POST',body:form})
    const result = await response.json()
    if (!response.ok) return res.status(response.status).json({error:result.detail || result.error || 'AI analysis failed'})
    // Save model outputs if real georeferenced GeoJSON is available.
    if (result.geojson?.features?.length) {
      const incoming = result.geojson.features.map((f, i) => {
        const id = String(f.properties?.id || `AI-${Date.now()}-${i+1}`)
        return {...f, id, properties:{...f.properties,id,reviewStatus:f.properties?.reviewStatus || 'pending'}}
      })
      if (dbEnabled) for (const feature of incoming) await upsertFeature(feature)
      else memoryFeatures = [...memoryFeatures.filter(f => !incoming.some(n => n.properties.id === f.properties?.id)), ...incoming]
    }
    res.json({...result,filename:req.file.originalname,persistedGeographicFeatures:Boolean(result.geojson?.features?.length)})
  } catch (e) { res.status(502).json({error:`AI service unavailable: ${e.message}. Ensure Python is running on port 8000.`}) }
})
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({error:'File too large.'})
  res.status(400).json({error:err.message || 'Request failed.'})
})
await initDatabase().catch(e => { console.error('Database initialization failed:', e.message); process.exitCode = 1 })
app.listen(PORT, () => console.log(`UrbanMap API running at http://localhost:${PORT}`))
