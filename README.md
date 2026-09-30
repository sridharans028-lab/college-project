# AeroCadastral AI
## Transforming Drone Vision into Smart Land Records

Smart India Hackathon prototype for AI-assisted urban parcel mapping, geospatial feature extraction, human verification and smart land-record workflows.

## Existing implementation and setup

AI-assisted urban parcel mapping and cadastral feature extraction using React, Express, Python, pretrained semantic segmentation and geospatial tooling.

## Implemented in this prototype
- React/Vite dashboard and interactive Leaflet map
- Leaflet-Geoman drawing and geometry-edit controls
- Human review workflow: pending / approved / rejected
- CSV and GeoJSON exports, plus downloadable HTML SIH summary report (open it and print to PDF)
- Python FastAPI inference service using pretrained SegFormer for general-scene building/road classes
- Heuristic parcel-candidate polygons generated around detected building groups
- GeoTIFF ingestion, CRS detection, affine transform and output conversion to EPSG:4326 GeoJSON
- Optional PostgreSQL/PostGIS persistence and spatial index
- In-memory fallback so the project runs without PostGIS

## Important accuracy and legal limitations
- The SegFormer model is a general-scene model, not trained specifically for cadastral mapping or drone orthomosaics.
- Heuristic parcel candidates are derived from buffered groups of detected building footprints. They are not detected legal property lines.
- Georeferencing is performed only for GeoTIFF files that contain valid CRS and affine geotransform metadata. PNG/JPG outputs remain in image-pixel coordinates and are not placed on the real-world map.
- Pixel-to-geographic transformation assumes the model mask uses the same dimensions as the preprocessed GeoTIFF preview. Validate this assumption for production-grade datasets.
- Map editing is enabled through Leaflet-Geoman. It is intended for manual review; use survey/cadastral reference data and qualified human verification before land-administration use.
- PostGIS is optional. Without `DATABASE_URL`, backend edits persist only in memory and reset when the backend restarts.
- The current demo's sample features use illustrative coordinates around Trichy, not official records.

## Requirements
- Windows 10/11
- Node.js 20+ and npm
- Python 3.10–3.12 (Python 3.12 recommended for package compatibility)
- VS Code
- Optional: Docker Desktop for PostGIS

## Windows VS Code setup

### A. Python AI service
Open a terminal in VS Code:

```powershell
cd "D:\SRI PROJECT\AI\urban-parcel-ai\ai-engine"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

If PowerShell blocks activation:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

AI model weights are downloaded at first inference, requiring internet access. CPU inference may take a while.

### B. Node/Express backend
Open a second terminal:

```powershell
cd "D:\SRI PROJECT\AI\urban-parcel-ai\server"
npm install
```

Copy `server/.env.example` to `server/.env` if you want to customize settings. To run without PostGIS, keep `DATABASE_URL` empty.

```powershell
npm run dev
```

### C. React frontend
Open a third terminal:

```powershell
cd "D:\SRI PROJECT\AI\urban-parcel-ai\client"
npm install
npm run dev
```

Open the URL Vite prints, normally http://localhost:5173.

### D. Optional PostGIS using Docker
Install and launch Docker Desktop, then from the project root run:

```powershell
docker compose up -d postgis
```

Copy `server/.env.example` to `server/.env` and set:

```dotenv
DATABASE_URL=postgresql://urbanmap:change_this_password@localhost:5432/urbanmap
PGSSL=false
```

Restart the backend. It will create the PostGIS extension/table/index on startup. Change the demo password before any non-local deployment. Alternatively, execute `database/schema.sql` in your own PostgreSQL/PostGIS database.

## API endpoints
- `GET /api/health` — backend status and database mode
- `GET /api/geojson` — feature collection
- `GET /api/parcels` — feature list
- `GET /api/stats` — current feature/review counts
- `POST /api/analysis` — upload image to Python inference service
- `PUT /api/parcels/:id` — save one reviewed/edited feature
- `POST /api/parcels/bulk` — save feature register

AI service:
- `GET http://127.0.0.1:8000/health`
- `POST http://127.0.0.1:8000/analyze`

## Suggested SIH demo
1. Start the Python, backend and frontend services.
2. Open Dashboard and explain the sample data is illustrative.
3. Upload a georeferenced GeoTIFF with a CRS and affine transform for map-aligned AI output.
4. Inspect the segmentation overlay and candidate feature list.
5. Use Map Explorer drawing/edit controls to correct polygons.
6. In Parcel Review, approve or reject selected features.
7. Export GeoJSON, CSV and the HTML report.
8. Explain that legal parcel boundaries require authoritative cadastral/survey references and human approval.

## Troubleshooting
- If `rasterio` installation fails, use Python 3.12 64-bit and upgrade pip before installing requirements.
- If the map is blank, check internet access for OpenStreetMap tiles and verify the frontend/backend ports.
- If model inference fails on first run, check internet connectivity and available RAM.
- If PostGIS is not configured, the app intentionally uses in-memory demo storage.
