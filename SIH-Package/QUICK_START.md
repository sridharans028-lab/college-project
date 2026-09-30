# Quick start (Windows / VS Code)

Open three terminals from the extracted project root.

## Terminal 1 — Python
```powershell
cd ai-engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Terminal 2 — Express
```powershell
cd server
npm install
npm run dev
```

## Terminal 3 — React
```powershell
cd client
npm install
npm run dev
```

Open the Vite URL, usually http://localhost:5173.

## Optional PostGIS
From the project root:
```powershell
docker compose up -d postgis
```
Configure `DATABASE_URL` in `server/.env` and restart the backend.
