from shapely.geometry import shape, mapping
from shapely.ops import unary_union

def build_parcel_candidates(features, buffer_pixels=18.0, max_candidates=40):
    """Create explicitly heuristic review candidates around detected buildings.

    These are NOT cadastral boundaries. They are convenience polygons for a reviewer
    to edit against authoritative parcel records or survey evidence.
    """
    buildings = []
    for feature in features:
        if feature.get("featureType") != "building":
            continue
        try:
            geom = shape(feature["geometry"])
            if not geom.is_empty and geom.is_valid:
                buildings.append(geom)
        except Exception:
            continue

    if not buildings:
        return []

    buffered = [g.buffer(buffer_pixels) for g in buildings]
    groups = unary_union(buffered)
    geoms = list(groups.geoms) if hasattr(groups, "geoms") else [groups]
    result = []
    for idx, geom in enumerate(sorted(geoms, key=lambda g: g.area, reverse=True)[:max_candidates], 1):
        if geom.is_empty:
            continue
        # Keep polygonal outputs only.
        if geom.geom_type == "MultiPolygon":
            geom = max(geom.geoms, key=lambda g: g.area)
        if geom.geom_type != "Polygon":
            geom = geom.convex_hull
        if geom.is_empty or geom.area <= 0:
            continue
        result.append({
            "id": f"PARCEL-CAND-{idx:03d}",
            "name": f"Heuristic parcel candidate {idx:03d}",
            "featureType": "parcel",
            "confidence": None,
            "reviewStatus": "pending",
            "candidateSource": "buffered_building_group",
            "geometry": mapping(geom),
            "coordinateSpace": "image_pixels",
        })
    return result
