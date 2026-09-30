from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from io import BytesIO
from PIL import Image, UnidentifiedImageError
import logging

app = FastAPI(title="UrbanMap AI Service", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)
logging.basicConfig(level=logging.INFO)

@app.get("/health")
def health():
    return {"status":"ok","service":"urbanmap-ai","mode":"pretrained-segmentation",
            "model":"nvidia/segformer-b0-finetuned-ade-512-512",
            "geotiff_support":True}

@app.post("/analyze")
async def analyze(image: UploadFile = File(...)):
    allowed = {".jpg",".jpeg",".png",".webp",".tif",".tiff"}
    suffix = Path(image.filename or "").suffix.lower()
    if suffix not in allowed:
        raise HTTPException(status_code=415, detail="Unsupported image format.")
    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image exceeds the 25 MB demo limit.")

    georef = None
    try:
        if suffix in {".tif", ".tiff"}:
            from app.gis.georeferencing import read_geotiff
            pil_image, georef = read_geotiff(content)
        else:
            pil_image = Image.open(BytesIO(content)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Could not read image/geospatial metadata: {exc}")

    try:
        from app.inference.segmenter import run_segmentation
        result = run_segmentation(pil_image)
        features = result["pixel_features"]
        geojson = None
        if georef:
            from app.gis.georeferencing import pixel_geojson_to_wgs84
            geojson = pixel_geojson_to_wgs84(features, georef)
        return {
            "status":"completed", "mode":"pretrained_model_inference",
            "filename":image.filename, "uploaded_bytes":len(content),
            "model_id":result["model_id"], "feature_count":len(features),
            "summary":result["summary"], "image_size":result["image_size"],
            "coordinate_space":"EPSG:4326" if georef else "image_pixels",
            "georeferenced":bool(georef), "source_crs":georef["crs"] if georef else None,
            "pixel_features":features, "geojson":geojson,
            "overlay_base64":result["overlay_base64"],
            "notice": (
                "Features are AI-generated proposals and require human review. "
                "Parcel candidates are heuristic proposals, not legal property boundaries. "
                + ("GeoTIFF transform converted output to EPSG:4326." if georef else
                   "This image has no georeferencing; coordinates remain image pixels and cannot be shown as real-world map features.")
            ),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception("Inference failed")
        raise HTTPException(status_code=500, detail=f"Model inference failed: {type(exc).__name__}: {exc}")
