import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Bell, Building2, ChevronDown, CircleHelp, Download, FileText, FolderKanban, Home, Layers, Map, MapPinned, Search, Settings, ShieldCheck, UploadCloud, Users, Zap, Check, X, Database, RefreshCw, ClipboardCheck } from 'lucide-react'
import StatCard from './components/StatCard'
import MapView from './components/MapView'
import { analyzeImage, getParcels, getStats, saveFeature, saveFeatures } from './services/api'

const sampleData = {type:'FeatureCollection',features:[
 {type:'Feature',id:'P-001',properties:{id:'P-001',name:'Sample Parcel 001',featureType:'parcel',confidence:92,reviewStatus:'pending'},geometry:{type:'Polygon',coordinates:[[[80.2688,13.0832],[80.2700,13.0832],[80.2700,13.0840],[80.2688,13.0840],[80.2688,13.0832]]]}},
 {type:'Feature',id:'B-001',properties:{id:'B-001',name:'Sample Building 001',featureType:'building',confidence:96,reviewStatus:'pending'},geometry:{type:'Polygon',coordinates:[[[80.2690,13.08335],[80.26935,13.08335],[80.26935,13.08365],[80.2690,13.08365],[80.2690,13.08335]]]}},
 {type:'Feature',id:'B-002',properties:{id:'B-002',name:'Sample Building 002',featureType:'building',confidence:89,reviewStatus:'pending'},geometry:{type:'Polygon',coordinates:[[[80.26955,13.0835],[80.26982,13.0835],[80.26982,13.08375],[80.26955,13.08375],[80.26955,13.0835]]]}}
]}
const navItems=[{label:'Dashboard',icon:Home},{label:'Map Explorer',icon:Map},{label:'AI Analysis',icon:Zap},{label:'Parcels & Review',icon:MapPinned},{label:'Projects',icon:FolderKanban},{label:'Reports & Export',icon:FileText},{label:'Database',icon:Database},{label:'Settings',icon:Settings}]
const normalizeFeature = (f,i) => ({...f,id:f.id || f.properties?.id || `FEATURE-${i+1}`,properties:{id:f.properties?.id || f.id || `FEATURE-${i+1}`,reviewStatus:'pending',...(f.properties||{})}})

export default function App(){
 const [active,setActive]=useState('Dashboard')
 const [geoData,setGeoData]=useState(sampleData)
 const [stats,setStats]=useState(null)
 const [selectedFile,setSelectedFile]=useState(null)
 const [analysis,setAnalysis]=useState(null)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [search,setSearch]=useState('')
 const [selectedId,setSelectedId]=useState(null)
 const [saving,setSaving]=useState(false)
 const [storageMode,setStorageMode]=useState('Loading…')

 const refreshData=useCallback(async()=>{
  try{
   const [geo,stat]=await Promise.all([getParcels(),getStats()])
   if(geo?.features?.length) setGeoData({type:'FeatureCollection',features:geo.features.map(normalizeFeature)})
   setStats(stat); setStorageMode(stat.storage)
  }catch{setStorageMode('API unavailable — showing sample data')}
 },[])
 useEffect(()=>{refreshData()},[refreshData])

 const features=geoData.features||[]
 const filtered=useMemo(()=>features.filter(f=>JSON.stringify(f.properties||{}).toLowerCase().includes(search.toLowerCase())),[features,search])
 const selected=features.find(f=>String(f.properties?.id||f.id)===String(selectedId))
 const count=(key)=>features.filter(f=>f.properties?.featureType===key).length
 const pending=features.filter(f=>!['approved','rejected'].includes(f.properties?.reviewStatus)).length
 const approved=features.filter(f=>f.properties?.reviewStatus==='approved').length
 const buildings=count('building'), parcelCount=count('parcel')

 const updateFeatureLocal=(updated)=>{
  setGeoData(old=>({type:'FeatureCollection',features:old.features.map(f=>String(f.properties?.id||f.id)===String(updated.properties?.id||updated.id)?updated:f)}))
 }
 const handleGeometryChange=useCallback((feature,kind)=>{
  const normalized=normalizeFeature(feature,features.length)
  setGeoData(old=>{
   const id=String(normalized.properties.id)
   const exists=old.features.some(f=>String(f.properties?.id||f.id)===id)
   return {type:'FeatureCollection',features:exists?old.features.map(f=>String(f.properties?.id||f.id)===id?normalized:f):[...old.features,normalized]}
  })
  setMessage(kind==='created'?'New polygon drawn. Select it in the review table and save it.':'Geometry changed on map. Save the selected feature to persist edits.')
 },[features.length])
 const handleSelect=useCallback(id=>setSelectedId(id),[])
 async function reviewFeature(status){
  if(!selected){setMessage('Select a feature from the table or map first.');return}
  const updated={...selected,properties:{...selected.properties,reviewStatus:status}}
  updateFeatureLocal(updated); setSaving(true)
  try{const result=await saveFeature(updated);setMessage(`${status==='approved'?'Approved':status==='rejected'?'Rejected':'Marked pending'}: ${updated.properties.name||updated.properties.id}${result.persistent?' (saved to PostGIS)':' (saved in demo memory only)'}`);await refreshData()}
  catch(e){setMessage(`Local status changed, but save failed: ${e.message}`)}
  finally{setSaving(false)}
 }
 async function saveAll(){
  setSaving(true)
  try{const result=await saveFeatures(features);setMessage(`${result.count} features saved${result.persistent?' to PostGIS':' to in-memory demo storage'}.`);await refreshData()}
  catch(e){setMessage(`Save failed: ${e.message}`)}
  finally{setSaving(false)}
 }
 async function runAnalysis(){
  if(!selectedFile){setMessage('Choose a drone image first.');return}
  setBusy(true);setMessage('Uploading image to the AI service…')
  try{
   const result=await analyzeImage(selectedFile);setAnalysis(result)
   if(result.geojson?.features?.length){
    const incoming=result.geojson.features.map(normalizeFeature)
    setGeoData(old=>({type:'FeatureCollection',features:[...old.features.filter(f=>!incoming.some(n=>n.properties.id===f.properties.id)),...incoming]}))
    setMessage(`AI inference completed: ${incoming.length} georeferenced features returned. Review before approval.`)
   }else{
    setMessage('AI inference completed. The uploaded image has no usable georeferencing; extracted polygons remain in image-pixel coordinates and are not overlaid on the geographic map.')
   }
  }catch(e){setMessage(`${e.message}. Check that the Python and Node services are running.`)}
  finally{setBusy(false)}
 }
 function downloadFile(name,content,type){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a')
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 function downloadGeoJSON(){downloadFile('urban-parcel-features.geojson',JSON.stringify(geoData,null,2),'application/geo+json')}
 function downloadCSV(){
  const rows=[['id','name','feature_type','confidence','review_status','candidate_source','geometry']]
  features.forEach(f=>rows.push([f.properties?.id||f.id,f.properties?.name,f.properties?.featureType,f.properties?.confidence,f.properties?.reviewStatus,f.properties?.candidateSource,JSON.stringify(f.geometry)]))
  const csv=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n')
  downloadFile('urban-parcel-features.csv',csv,'text/csv;charset=utf-8')
 }
 function downloadReport(){
  const byType={building:count('building'),parcel:count('parcel'),road:count('road')}
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>AeroCadastral AI Report</title><style>body{font:14px Arial;margin:40px;color:#1e293b}h1{color:#1d4ed8}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}.muted{color:#64748b}</style></head><body><h1>AeroCadastral AI — SIH26012</h1><p class="muted">AI-assisted urban parcel mapping · Generated ${new Date().toLocaleString()}</p><h2>Summary statistics</h2><ul><li>Total features: ${features.length}</li><li>Buildings: ${byType.building}</li><li>Parcel candidates: ${byType.parcel}</li><li>Roads: ${byType.road}</li><li>Pending review: ${pending}</li><li>Approved: ${approved}</li><li>Rejected: ${features.filter(f=>f.properties?.reviewStatus==='rejected').length}</li></ul><h2>Feature register</h2><table><tr><th>ID</th><th>Name</th><th>Type</th><th>Confidence</th><th>Status</th></tr>${features.map(f=>`<tr><td>${String(f.properties?.id||f.id).replaceAll('&','&amp;').replaceAll('<','&lt;')}</td><td>${String(f.properties?.name||'').replaceAll('&','&amp;').replaceAll('<','&lt;')}</td><td>${f.properties?.featureType||''}</td><td>${f.properties?.confidence??'—'}</td><td>${f.properties?.reviewStatus||'pending'}</td></tr>`).join('')}</table><p class="muted">AI-generated features and heuristic parcel candidates require human verification and are not legal cadastral boundaries.</p></body></html>`
  downloadFile('aerocadastral-sih-report.html',html,'text/html;charset=utf-8')
 }

 return <div className="app-shell">
  <aside className="sidebar"><div className="brand"><div className="brand-mark"><MapPinned size={22}/></div><div><strong>AeroCadastral AI</strong><small>Drone-to-Land Records Platform</small></div></div>
   <nav>{navItems.map(({label,icon:Icon})=><button key={label} className={active===label?'nav-item active':'nav-item'} onClick={()=>setActive(label)}><Icon size={17}/><span>{label}</span></button>)}</nav>
   <div className="sidebar-bottom"><ShieldCheck size={18}/><div><strong>SIH Prototype</strong><small>Smart Land Records</small></div></div>
  </aside>
  <main className="main-area"><header className="topbar"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search projects, parcels…"/></div><div className="top-actions"><button className="icon-button" title="Notifications"><Bell size={18}/><i/></button><div className="profile"><div className="avatar">S</div><div><strong>SIH Operator</strong><small>Mapping reviewer</small></div><ChevronDown size={15}/></div></div></header>
   <div className="page-content"><div className="page-heading"><div><div className="eyebrow">SMART INDIA HACKATHON · SIH26012</div><h1>{active==='Dashboard'?'Welcome to AeroCadastral AI':active}</h1><p>AI-assisted mapping, geospatial validation and human-reviewed cadastral feature proposals.</p></div><button className="primary-btn" onClick={()=>setActive('AI Analysis')}><UploadCloud size={16}/> Upload New Image</button></div>
    {active==='Dashboard'&&<>
     <div className="stats-grid"><StatCard icon={MapPinned} label="Loaded Features" value={features.length} tone="blue" note="Current feature register"/><StatCard icon={Building2} label="Buildings" value={buildings} tone="green" note="Detected footprint features"/><StatCard icon={Layers} label="Parcel Candidates" value={parcelCount} tone="purple" note="Require verification"/><StatCard icon={ClipboardCheck} label="Pending Review" value={pending} tone="orange" note={`${approved} approved`}/></div>
     <div className="dashboard-grid"><section className="panel map-panel"><div className="panel-heading"><div><h2>Urban Feature Map</h2><p>Sample features around Trichy for UI demonstration</p></div><button className="text-btn" onClick={()=>setActive('Map Explorer')}>Explore map →</button></div><MapView data={geoData} compact onFeatureSelect={handleSelect} onGeometryChange={handleGeometryChange}/></section>
      <section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick Actions</h2><p>Mapping workflow</p></div></div><button className="action-btn blue-action" onClick={()=>setActive('AI Analysis')}><UploadCloud size={17}/> Upload Drone Image</button><button className="action-btn green-action" onClick={()=>setActive('Parcels & Review')}><ClipboardCheck size={17}/> Review Features</button><button className="action-btn neutral-action" onClick={downloadGeoJSON}><Download size={17}/> Export GeoJSON</button><button className="action-btn neutral-action" onClick={downloadReport}><FileText size={17}/> Generate Report</button><div className="notice"><Database size={16}/><span>Storage: {storageMode}</span></div></section></div>
     <section className="panel"><div className="panel-heading"><div><h2>Review progress</h2><p>Current in-memory or persisted feature register</p></div><button className="secondary-btn" onClick={refreshData}><RefreshCw size={15}/> Refresh</button></div><div className="review-progress"><div><span>Approved</span><strong>{approved}</strong></div><div><span>Pending</span><strong>{pending}</strong></div><div><span>Rejected</span><strong>{features.filter(f=>f.properties?.reviewStatus==='rejected').length}</strong></div></div></section>
    </>}
    {active==='Map Explorer'&&<section className="panel"><div className="panel-heading"><div><h2>Editable GIS Map</h2><p>Use the left-side drawing/edit controls to create or adjust geometries. Save changes in Parcel Review.</p></div><button className="secondary-btn" onClick={downloadGeoJSON}><Download size={16}/> Export GeoJSON</button></div><MapView data={{...geoData,features:filtered}} onFeatureSelect={handleSelect} onGeometryChange={handleGeometryChange}/><p className="map-help">Select a feature on the map to review it. Drawing/editing tools require georeferenced inputs for meaningful real-world coordinates.</p></section>}
    {active==='AI Analysis'&&<div className="analysis-grid"><section className="panel upload-panel"><div className="panel-heading"><div><h2>Upload & Analyse</h2><p>GeoTIFF preserves spatial reference when valid metadata is present.</p></div></div><label className="dropzone"><UploadCloud size={38}/><strong>{selectedFile?selectedFile.name:'Choose a drone image or GeoTIFF'}</strong><span>PNG, JPG, WEBP, TIFF / GeoTIFF</span><input type="file" accept=".png,.jpg,.jpeg,.tif,.tiff,.webp" onChange={e=>{setSelectedFile(e.target.files?.[0]||null);setMessage('')}}/><em>Maximum upload size: 25 MB in this prototype</em></label><button className="primary-btn full-btn" disabled={busy} onClick={runAnalysis}>{busy?'Processing…':'Run AI Analysis'} <Zap size={16}/></button>{message&&<div className="message-box">{message}</div>}{analysis&&<div className="result-box"><strong>AI inference results</strong><div>Mode: {analysis.mode}</div><div>Model: {analysis.model_id||'—'}</div><div>Candidate features: {analysis.feature_count}</div><div>Coordinate space: {analysis.coordinate_space}</div><div>Georeferenced: {analysis.georeferenced?'Yes':'No'}</div>{analysis.summary&&<div>Classes: {Object.entries(analysis.summary).map(([k,v])=>`${k}: ${v}`).join(' · ')||'No target features found'}</div>}{analysis.overlay_base64&&<div className="overlay-preview"><strong>Segmentation overlay</strong><img alt="AI segmentation overlay" src={`data:image/jpeg;base64,${analysis.overlay_base64}`}/></div>}<div className="warning-copy">{analysis.notice}</div></div>}</section>
     <section className="panel"><div className="panel-heading"><div><h2>Processing pipeline</h2><p>Inference and geospatial validation status</p></div></div><div className="pipeline">{['Upload image','Validate image / GeoTIFF CRS','Run pretrained segmentation','Extract building / road masks','Generate heuristic parcel candidates','Georeference and review','Export GIS features'].map((step,i)=><div className="pipeline-step" key={step}><div className={`step-num ${analysis&&i<5?'done':i===0&&selectedFile?'done':''}`}>{analysis&&i<5?'✓':i+1}</div><div><strong>{step}</strong><small>{analysis&&i<5?'Completed':i===4?'Heuristic proposal only':'Waiting'}</small></div></div>)}</div><div className="notice warning"><CircleHelp size={17}/><span>SegFormer is a general-scene model. Parcel proposals are not legal boundaries; review them against authoritative survey data.</span></div></section></div>}
    {active==='Parcels & Review'&&<section className="panel"><div className="panel-heading"><div><h2>Feature Verification</h2><p>Select a row or map feature, then approve or reject the proposal.</p></div><button className="secondary-btn" disabled={saving} onClick={saveAll}><Database size={15}/> Save all</button></div><div className="review-toolbar"><button className="approve-btn" disabled={!selected||saving} onClick={()=>reviewFeature('approved')}><Check size={15}/> Approve selected</button><button className="reject-btn" disabled={!selected||saving} onClick={()=>reviewFeature('rejected')}><X size={15}/> Reject selected</button><button className="secondary-btn" disabled={!selected||saving} onClick={()=>reviewFeature('pending')}>Mark pending</button></div>{message&&<div className="message-box">{message}</div>}{selected&&<div className="selected-feature"><strong>Selected: {selected.properties?.name||selected.properties?.id}</strong><span>Type: {selected.properties?.featureType} · Confidence: {selected.properties?.confidence??'—'} · Status: {selected.properties?.reviewStatus}</span><span>Use the map editing tools to adjust geometry, then save all changes.</span></div>}<div className="table-wrap"><table><thead><tr><th>Select</th><th>Feature</th><th>Type</th><th>Confidence</th><th>Status</th><th>Source</th></tr></thead><tbody>{filtered.map((f,i)=>{const id=String(f.properties?.id||f.id||i);return <tr key={id} className={selectedId===id?'selected-row':''} onClick={()=>setSelectedId(id)}><td><input type="radio" checked={selectedId===id} onChange={()=>setSelectedId(id)}/></td><td>{f.properties?.name||id}</td><td>{f.properties?.featureType||'unknown'}</td><td>{f.properties?.confidence??'—'}</td><td><span className={`status ${f.properties?.reviewStatus==='approved'?'complete':f.properties?.reviewStatus==='rejected'?'rejected':'pending'}`}>{f.properties?.reviewStatus||'pending'}</span></td><td>{f.properties?.candidateSource||'AI / sample'}</td></tr>})}</tbody></table></div><div className="notice warning"><ShieldCheck size={16}/><span>Approval records reviewer decisions in the prototype. It does not certify legal ownership or cadastral correctness.</span></div></section>}
    {active==='Projects'&&<section className="panel"><div className="panel-heading"><div><h2>Mapping Projects</h2><p>Prototype workspace</p></div></div><p className="empty-info">Use AI Analysis to upload imagery and Parcel Review to verify extracted features. Multi-project persistence is a future extension.</p></section>}
    {active==='Reports & Export'&&<section className="panel"><div className="panel-heading"><div><h2>Reports & Export</h2><p>Export the current feature register and review statistics.</p></div></div><div className="export-grid"><button className="export-card" onClick={downloadGeoJSON}><Download/><strong>Export GeoJSON</strong><span>Feature geometries and properties</span></button><button className="export-card" onClick={downloadCSV}><FileText/><strong>Export CSV</strong><span>Attributes and review statuses</span></button><button className="export-card" onClick={downloadReport}><ClipboardCheck/><strong>Generate SIH report</strong><span>HTML report suitable for printing to PDF</span></button><button className="export-card" onClick={saveAll}><Database/><strong>Save feature register</strong><span>PostGIS if configured, otherwise demo memory</span></button></div><div className="stats-grid report-stats"><StatCard icon={Layers} label="Total features" value={features.length} tone="blue"/><StatCard icon={Building2} label="Buildings" value={buildings} tone="green"/><StatCard icon={MapPinned} label="Parcel candidates" value={parcelCount} tone="purple"/><StatCard icon={ClipboardCheck} label="Pending" value={pending} tone="orange"/></div></section>}
    {active==='Database'&&<section className="panel"><div className="panel-heading"><div><h2>Database & Persistence</h2><p>Current storage mode</p></div><button className="secondary-btn" onClick={refreshData}><RefreshCw size={15}/> Refresh status</button></div><div className="database-status"><Database size={26}/><div><strong>{storageMode}</strong><p>Set DATABASE_URL in server/.env and create the PostGIS schema to persist features across restarts. Without it, backend data is kept in memory only.</p></div></div><pre className="code-snippet">CREATE EXTENSION IF NOT EXISTS postgis;</pre><p className="empty-info">Schema file: <code>database/schema.sql</code>. Geometry is stored as EPSG:4326. PostGIS support is optional, so the prototype can run without a database server.</p></section>}
    {active==='Settings'&&<section className="panel"><div className="empty-state"><Settings size={30}/><h2>Settings</h2><p>API defaults are documented in the root README and server/.env.example.</p></div></section>}
    <footer>AeroCadastral AI · SIH26012 · Advanced prototype <span>AI suggestions require review; not an official cadastral record.</span></footer>
   </div>
  </main>
 </div>
}
