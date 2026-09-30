INSERT INTO parcel_features (id,name,feature_type,confidence,review_status,properties,geom)
VALUES
('DEMO-P-001','Illustrative Parcel 001','parcel',0.92,'pending',
 '{"id":"DEMO-P-001","candidateSource":"demo","note":"Illustrative only"}',
 ST_SetSRID(ST_GeomFromText('POLYGON((80.2688 13.0832,80.2700 13.0832,80.2700 13.0840,80.2688 13.0840,80.2688 13.0832))'),4326))
ON CONFLICT (id) DO NOTHING;
