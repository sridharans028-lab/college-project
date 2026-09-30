# AeroCadastral AI — SIH Demo Plan
**Theme:** Transforming Drone Vision into Smart Land Records  
**Suggested duration:** 6 minutes

## Before the demo
- [ ] Start Python AI service on port 8000.
- [ ] Start Express API on port 5000.
- [ ] Start React/Vite frontend (normally port 5173).
- [ ] Confirm `/api/health` and Python `/health` respond.
- [ ] Have a small GeoTIFF ready with a known CRS and affine transform.
- [ ] Have one fallback image ready; note that ordinary JPG/PNG images are not map-georeferenced by this pipeline.
- [ ] Confirm whether PostGIS is connected; do not imply persistence if running in memory mode.
- [ ] Keep a sample GeoJSON export available as a fallback.

## Six-minute narration
**0:00–0:40 — Problem and goal**  
“Manual interpretation of aerial imagery can be time-consuming. AeroCadastral AI explores an AI-assisted workflow for extracting visible features and preparing them for human review.”

**0:40–1:20 — Architecture**  
Show React + Leaflet, Express API, Python inference and optional PostGIS. Explain the separation of user interface, application API and AI processing.

**1:20–2:20 — Upload and AI inference**  
Upload a georeferenced GeoTIFF and run analysis. Show the segmentation overlay, class summary and coordinate-space status. Explain that the pretrained model is a prototype baseline.

**2:20–3:20 — Map and geometry editing**  
Open Map Explorer. Select a feature and demonstrate editing/drawing tools. Explain that geometry should be checked against authoritative survey/cadastral reference data.

**3:20–4:20 — Human verification**  
Select a feature, approve it, then reject a different feature. Show the review statuses and the statistics update.

**4:20–5:15 — Export and persistence**  
Export GeoJSON and CSV, then generate the HTML report. If PostGIS is configured, show the database status; otherwise transparently describe demo memory storage.

**5:15–6:00 — Impact and limitations**  
“This is an assistive prototype, not a legal boundary certification system. Our next step is validation against labelled local imagery and authoritative parcel records.”

## Likely judge questions

### What is novel about the workflow?
It combines imagery ingestion, AI-assisted feature extraction, georeferencing, editable map review, status tracking and GIS exports in one prototype workflow. Novelty should be demonstrated against the chosen problem statement and competing systems rather than asserted without comparison.

### Does the AI detect legal parcel boundaries?
No. The current model segments general visual classes such as buildings and roads. Parcel candidates are heuristic proposals, not legal boundaries. Cadastral-specific training and authoritative references are required.

### How do you ensure geospatial correctness?
Read CRS and affine transform metadata from GeoTIFF, convert coordinates, then validate known control points and compare outputs against reference layers. A successful conversion alone does not guarantee positional accuracy.

### What happens if the input is JPG or PNG?
The model can process the image, but without georeferencing metadata the outputs remain in image-pixel coordinates and should not be treated as real-world map locations.

### Is the data saved permanently?
Only when PostgreSQL/PostGIS is configured. Otherwise the prototype uses in-memory demo storage and backend restarts clear saved state.

### How will you measure accuracy?
Use a representative labelled dataset and report precision, recall, F1, polygon IoU, boundary displacement and georeferencing residuals. Do not invent results before running these evaluations.

## Demo recovery plan
- If AI inference is slow: explain first-run model download and use a prepared sample feature layer.
- If PostGIS is unavailable: continue in demo-memory mode and explain the optional persistence layer.
- If a GeoTIFF lacks CRS: explain the validation error and switch to a known georeferenced file.
- If map tiles are unavailable: show exported GeoJSON and the local feature table; map tiles require network access.
