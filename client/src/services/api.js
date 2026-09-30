const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'
async function request(url, options) {
  const response = await fetch(`${API_BASE}${url}`, options)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Request failed')
  return result
}
export const getParcels = () => request('/geojson')
export const getStats = () => request('/stats')
export async function analyzeImage(file) {
  const form = new FormData()
  form.append('image', file)
  return request('/analysis', {method:'POST',body:form})
}
export const saveFeature = (feature) => request(`/parcels/${encodeURIComponent(feature.properties.id)}`, {
  method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({feature})
})
export const saveFeatures = (features) => request('/parcels/bulk', {
  method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({features})
})
