# AeroCadastral AI
## Transforming Drone Vision into Smart Land Records

**SIH project summary**

AeroCadastral AI is a web-based prototype for AI-assisted extraction and review of visible urban features from drone imagery. It combines React and Leaflet for the mapping interface, Express for application APIs, Python for inference and geospatial processing, and optional PostgreSQL/PostGIS for persistent spatial records.

### Problem
Digitising visible features from aerial imagery can require substantial manual effort. Reviewers need an efficient way to create candidate GIS features, correct them, record decisions and export structured data.

### Proposed workflow
1. Upload drone imagery or a georeferenced GeoTIFF.
2. Run pretrained image segmentation to identify candidate building and road regions.
3. Convert masks into polygon geometries.
4. Transform pixel coordinates to EPSG:4326 when valid GeoTIFF CRS and affine metadata exist.
5. Review and edit geometries; approve or reject candidates.
6. Export GeoJSON, CSV and a summary report, with optional PostGIS storage.

### Prototype stack
React · Vite · Leaflet · Leaflet-Geoman · Node.js · Express · Python · FastAPI · PyTorch · SegFormer · Rasterio · PyProj · OpenCV · Shapely · PostgreSQL/PostGIS.

### Evaluation plan
Test on representative labelled drone imagery. Measure precision, recall, F1, polygon IoU, boundary displacement, georeferencing residuals, inference time and reviewer correction time.

### Key limitation
The current pretrained model is a general-scene baseline. Parcel proposals are heuristic and must not be represented as legal property boundaries. Operational use requires cadastral-specific validation, authoritative survey references and qualified human review.
