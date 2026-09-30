from functools import lru_cache
from io import BytesIO
import base64

try:
    import cv2  # type: ignore[import-not-found]
except ImportError as exc:
    cv2 = None
    _CV2_IMPORT_ERROR = exc
else:
    _CV2_IMPORT_ERROR = None

try:
    import numpy as np  # type: ignore[import-not-found]
except ImportError as exc:
    raise ImportError(
        "NumPy is required for image segmentation. Install it with `pip install numpy`."
    ) from exc
try:
    from PIL import Image  # type: ignore[import-not-found]
except ImportError as exc:
    raise ImportError(
        "Pillow is required for image segmentation. Install it with `pip install Pillow`."
    ) from exc
from app.postprocessing.parcel_candidates import build_parcel_candidates

MODEL_ID = "nvidia/segformer-b0-finetuned-ade-512-512"
TARGET_LABELS = {"building", "road"}

@lru_cache(maxsize=1)
def get_segmenter():
    # Weights are downloaded from Hugging Face on first inference.
    try:
        from importlib import import_module

        pipeline = import_module("transformers").pipeline
    except (ImportError, AttributeError) as exc:
        raise ImportError(
            "Transformers is required for image segmentation. "
            "Install it with `pip install transformers`."
        ) from exc

    return pipeline("image-segmentation", model=MODEL_ID, device=-1)


def _mask_to_polygons(mask_image, min_area=100, max_polygons=100):
    mask = np.asarray(mask_image.convert("L"))
    binary = (mask > 127).astype(np.uint8)

    # Reject empty masks and suspiciously large masks.
    coverage = float(binary.mean())
    if coverage < 0.001:
        return [], np.zeros_like(binary)

    # Remove small disconnected noise components.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        binary, connectivity=8
    )

    clean_binary = np.zeros_like(binary)
    components = []

    for idx in range(1, count):
        area = int(stats[idx, cv2.CC_STAT_AREA])
        if area >= min_area:
            components.append((area, idx))

    components.sort(reverse=True)
    polygons = []

    for area, idx in components[:max_polygons]:
        component = (labels == idx).astype(np.uint8) * 255
        contours, _ = cv2.findContours(
            component, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        if not contours:
            continue

        contour = max(contours, key=cv2.contourArea)
        epsilon = max(1.0, 0.003 * cv2.arcLength(contour, True))
        simplified = cv2.approxPolyDP(contour, epsilon, True)
        points = [
            [int(point[0][0]), int(point[0][1])]
            for point in simplified
        ]

        if len(points) >= 3:
            points.append(points[0])
            polygons.append({
                "type": "Polygon",
                "coordinates": [points],
                "area_pixels": round(float(cv2.contourArea(contour)), 1),
            })
            clean_binary[labels == idx] = 1

    return polygons, clean_binary

def run_segmentation(image: Image.Image):
    image = image.convert("RGB")
    raw_results = get_segmenter()(image)
    selected, pixel_features = [], []
    overlay_arr = np.asarray(image).copy()
    palette = {"building": (239, 68, 68), "road": (37, 99, 235)}
    summary = {}

    for item in raw_results:
        label = str(item.get("label", "")).strip().lower()
        if label not in TARGET_LABELS or item.get("mask") is None:
            continue
        polygons, binary = _mask_to_polygons(item["mask"])
        if not polygons:
            continue
        score_value = item.get("score")
        score = round(float(score_value), 4) if score_value is not None else 0.0
        color = np.array(palette[label], dtype=np.uint8)

        contours, _ = cv2.findContours(
            (binary > 0).astype(np.uint8),
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )
        if contours:
            cv2.drawContours(overlay_arr, contours, -1, color.tolist(), 2)

        summary[label] = summary.get(label, 0) + len(polygons)
        for polygon in polygons:
            pixel_features.append({
                "id": f"{label.upper()}-{len(pixel_features)+1:03d}",
                "name": f"Detected {label} {len(pixel_features)+1:03d}",
                "featureType": label,
                "confidence": score,
                "areaPixels": polygon["area_pixels"],
                "reviewStatus": "pending",
                "geometry": {"type": polygon["type"], "coordinates": polygon["coordinates"]},
                "coordinateSpace": "image_pixels",
            })

    # Parcel candidates are heuristic proposals from groups of building footprints,
    # not inferred legal property lines.
    candidates = build_parcel_candidates(pixel_features)
    pixel_features.extend(candidates)
    for feature in candidates:
        summary["parcel_candidate"] = summary.get("parcel_candidate", 0) + 1

    buffer = BytesIO()
    Image.fromarray(overlay_arr).save(buffer, format="JPEG", quality=88)
    return {
        "model_id": MODEL_ID,
        "summary": summary,
        "pixel_features": pixel_features,
        "overlay_base64": base64.b64encode(buffer.getvalue()).decode("ascii"),
        "image_size": {"width": image.width, "height": image.height},
    }
