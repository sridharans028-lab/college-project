from rasterio.io import MemoryFile
from rasterio.enums import Resampling
from pyproj import Transformer
from affine import Affine
from PIL import Image
import numpy as np

def read_geotiff(content: bytes):
    """Return an RGB preview image and georeferencing metadata from a GeoTIFF."""
    with MemoryFile(content) as memfile:
        with memfile.open() as src:
            if src.crs is None:
                raise ValueError("GeoTIFF has no CRS. Provide a georeferenced raster with a declared CRS.")
            out_h = min(src.height, 2048)
            out_w = min(src.width, 2048)
            bands = min(src.count, 3)
            if bands >= 3:
                arr = src.read([1, 2, 3], out_shape=(3, out_h, out_w), resampling=Resampling.bilinear)
                arr = np.moveaxis(arr, 0, -1)
            else:
                one = src.read(1, out_shape=(out_h, out_w), resampling=Resampling.bilinear)
                arr = np.stack([one, one, one], axis=-1)
            arr = _to_uint8(arr)
            image = Image.fromarray(arr, mode="RGB")
            # Transform is scaled to the reduced preview/model input dimensions.
            sx, sy = src.width / out_w, src.height / out_h
            scaled_transform = src.transform * Affine.scale(sx, sy)
            metadata = {
                "crs": src.crs.to_string(),
                "transform": tuple(scaled_transform)[:6],
                "width": out_w,
                "height": out_h,
                "source_width": src.width,
                "source_height": src.height,
                "is_georeferenced": True,
            }
            return image, metadata

def _to_uint8(arr):
    arr = arr.astype(np.float32)
    if arr.max() <= 1.0:
        arr *= 255.0
    out = np.zeros_like(arr, dtype=np.uint8)
    for band in range(arr.shape[-1]):
        b = arr[..., band]
        lo, hi = np.percentile(b, [2, 98])
        if hi > lo:
            out[..., band] = np.clip((b - lo) * 255.0 / (hi - lo), 0, 255).astype(np.uint8)
        else:
            out[..., band] = np.clip(b, 0, 255).astype(np.uint8)
    return out

def pixel_geojson_to_wgs84(features, metadata):
    """Convert image-pixel polygon vertices to longitude/latitude GeoJSON."""
    transform = Affine(*metadata["transform"])
    transformer = Transformer.from_crs(metadata["crs"], "EPSG:4326", always_xy=True)

    def convert_coords(coords):
        if not coords:
            return coords
        if isinstance(coords[0], (int, float)):
            col, row = coords[0], coords[1]
            x, y = transform * (col, row)
            lon, lat = transformer.transform(x, y)
            return [lon, lat]
        return [convert_coords(item) for item in coords]

    converted = []
    for f in features:
        geom = f.get("geometry")
        if not geom:
            continue
        converted.append({
            "type": "Feature",
            "properties": {k: v for k, v in f.items() if k not in ("geometry", "coordinateSpace")},
            "geometry": {
                "type": geom["type"],
                "coordinates": convert_coords(geom.get("coordinates", [])),
            },
        })
    return {"type": "FeatureCollection", "features": converted}
