import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "@geoman-io/leaflet-geoman-free";

function MapLayers({data, onFeatureSelect, onGeometryChange}) {
  const map = useMap()
  useEffect(() => {
    map.pm.addControls({
      position:'topleft', drawMarker:false, drawCircle:false, drawCircleMarker:false,
      drawText:false, drawPolyline:true, drawRectangle:true, drawPolygon:true,
      editMode:true, dragMode:true, cutPolygon:false, removalMode:true, rotateMode:false
    })
    const layerGroup = L.featureGroup().addTo(map)
    const idToLayer = new Map()
    const styleFor = (feature) => {
      const p = feature.properties || {}
      if (p.reviewStatus === 'approved') return {color:'#16a34a',weight:2,fillColor:'#22c55e',fillOpacity:.28}
      if (p.reviewStatus === 'rejected') return {color:'#64748b',weight:2,dashArray:'5 5',fillColor:'#94a3b8',fillOpacity:.12}
      if (p.featureType === 'building') return {color:'#ef4444',weight:2,fillColor:'#fb7185',fillOpacity:.48}
      if (p.featureType === 'road') return {color:'#2563eb',weight:3,fillOpacity:.15}
      return {color:'#eab308',weight:2,fillColor:'#facc15',fillOpacity:.2}
    }
    ;(data?.features || []).forEach((feature, index) => {
      if (!feature.geometry || !['Polygon','MultiPolygon','LineString','MultiLineString','Point'].includes(feature.geometry.type)) return
      const id = String(feature.properties?.id || feature.id || `feature-${index+1}`)
      feature.properties = {...feature.properties, id}
      const layer = L.geoJSON(feature, {style:styleFor, pointToLayer:(_f,latlng)=>L.circleMarker(latlng,{radius:6,...styleFor(feature)})})
      layer.eachLayer(child => {
        child.on('click', () => onFeatureSelect?.(id))
        child.bindTooltip(`${feature.properties.name || id} · ${feature.properties.reviewStatus || 'pending'}`)
      })
      layer.addTo(layerGroup); idToLayer.set(id, layer)
    })
    map.on('pm:create', e => {
      const feature = e.layer.toGeoJSON()
      const id = `MANUAL-${Date.now()}`
      feature.properties = {id,name:`Manually drawn feature ${id}`,featureType:'parcel',reviewStatus:'pending',candidateSource:'manual_digitization'}
      e.layer.feature = feature
      e.layer.setStyle?.(styleFor(feature))
      e.layer.on('click', () => onFeatureSelect?.(id))
      idToLayer.set(id, L.layerGroup([e.layer]))
      onGeometryChange?.(feature, 'created')
    })
    map.on('pm:edit', e => {
      const layer = e.layer
      if (layer?.toGeoJSON) {
        const feature = layer.toGeoJSON()
        const existingId = layer.feature?.properties?.id
        feature.properties = {...(layer.feature?.properties || {}), ...feature.properties, id:existingId || `EDIT-${Date.now()}`}
        layer.feature = feature
        onGeometryChange?.(feature, 'edited')
      }
    })
    map.on('pm:remove', e => {
      const feature = e.layer?.feature
      if (feature?.properties?.id) onGeometryChange?.({...feature, properties:{...feature.properties, reviewStatus:'rejected'}}, 'removed')
    })
    if (data?.features?.length) {
      const bounds = layerGroup.getBounds()
      if (bounds.isValid()) map.fitBounds(bounds.pad(.15), {maxZoom:19})
    }
    return () => {
      map.off('pm:create'); map.off('pm:edit'); map.off('pm:remove')
      map.removeLayer(layerGroup)
      map.pm.removeControls()
    }
  }, [map, data, onFeatureSelect, onGeometryChange])
  return null
}

export default function MapView({data, onFeatureSelect, onGeometryChange, compact=false}) {
  return <div className={`map-wrap ${compact ? 'map-compact' : ''}`}>
    <MapContainer center={[13.0827,80.2707]} zoom={16} scrollWheelZoom className="map">
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <MapLayers data={data} onFeatureSelect={onFeatureSelect} onGeometryChange={onGeometryChange}/>
    </MapContainer>
    <div className="map-legend"><span><i className="red"/> Buildings</span><span><i className="yellow"/> Parcels / pending</span><span><i className="green"/> Approved</span><span><i className="gray"/> Rejected</span></div>
  </div>
}
