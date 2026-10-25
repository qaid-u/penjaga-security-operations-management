import { Component, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { buildingConfig } from './buildingConfig';
import { useBuildingAsset } from './useBuildingAsset';
import { BuildingModel } from './BuildingModel';
import { BuildingHotspot } from './BuildingHotspot';
import { CameraController } from './CameraController';
import { BuildingLoadingState } from './BuildingLoadingState';
import { ViewerToolbar } from './ViewerToolbar';
import { LocationInformationPanel } from './LocationInformationPanel';
import { useAuth } from '../../context/AuthContext';
import { ROLE } from '../../utils/helpers';
import { use3DOperations } from './use3DOperations';
import { OperationalToolbar } from './OperationalToolbar';
import { LocationMappingPanel } from './LocationMappingPanel';
import { indicator } from './operationalIndicators';
import { AdvancedFilters } from './AdvancedFilters';
import { emptyFilters, klDay } from './operationalFilters';
import { OperationalAnalytics } from './OperationalAnalytics';
import { IncidentHistory } from './IncidentHistory';
import { cameraPresets } from './buildingZones';
import { Button, Field, Select } from '../ui';
import { Box, Maximize2 } from 'lucide-react';
import { getBuilding } from './buildingModels';

class ViewerBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <BuildingLoadingState error="Model atau enjin grafik gagal dimuatkan. Semak sambungan dan cuba lagi." onRetry={this.props.onRetry} /> : this.props.children; }
}

function ContextMonitor({ onLost }) {
  const { gl } = useThree();
  useEffect(() => {
    const lost = (event) => { event.preventDefault(); onLost(); };
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => gl.domElement.removeEventListener('webglcontextlost', lost);
  }, [gl, onLost]);
  return null;
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

function LoadedViewer({ onRetry, supported, building }) {
  const { data, progress, error } = useBuildingAsset(building.modelUrl, building);
  const [selected, setSelected] = useState(null);
  const { user } = useAuth();
  const [period, updatePeriod] = useState(() => { const date = klDay(); return { date, from: date, to: date }; });
  const [mode, updateMode] = useState('coverage');
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [sheet, setSheet] = useState(false);
  const panel = useRef(null);
  const trigger = useRef(null);
  const setPeriod = (value) => { updatePeriod(value); setPage(1); };
  const setMode = (value) => { updateMode(value); setPage(1); };
  const change = (key, value) => { setFilters((old) => ({ ...old, [key]: value })); setPage(1); };
  const operations = use3DOperations(selected, period, filters, mode, page, building.id);
  const locationIndicator = (id) => indicator(operations.overview.data?.locations.find((item) => item.hotspot_id === id), mode, operations.overview.isError || operations.overview.isPending);
  const [showHotspots, setShowHotspots] = useState(true);
  const [lost, setLost] = useState(false);
  const [command, setCommand] = useState({ reset: 0, zoom: null, preset: 'overview' });
  const viewData = data || { hotspots: building.hotspots, zones: [] };
  const stage = useRef(null);
  const location = viewData.hotspots.find((item) => item.id === selected);
  const select = (id, openPanel = true) => {
    trigger.current = document.activeElement;
    setSelected(id); setSheet(openPanel && Boolean(id));
    // Unconfirmed indoor posts must not move the camera to exterior anchors.
    if (viewData.hotspots.find((item) => item.id === id)?.position) setCommand((old) => ({ ...old, preset: 'selected', reset: old.reset + 1 }));
    if (openPanel) requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
  };
  const reset = () => { setSelected(null); setSheet(false); change('zone',''); setCommand((old) => ({ ...old, preset: 'overview', reset: old.reset + 1 })); };
  const onZone = (id) => { change('zone',id); if (id) select(id); else { setSelected(null); setSheet(false); setCommand((old) => ({ ...old, preset: 'overview', reset: old.reset+1 })); } };
  const resetFilters = () => { setFilters(emptyFilters); setPage(1); updateMode('coverage'); const date = operations.references.data?.today || klDay(); updatePeriod({date,from:date,to:date}); reset(); };
  const onMetric = (key) => {
    setPage(1);
    if (['reports','high_critical','unmapped_reports'].includes(key)) { setMode('incidents'); setFilters((old) => ({...old, risk: key === 'high_critical' ? 'HighCritical' : old.risk, ...(key === 'unmapped_reports' ? {mapping:'unlinked',zone:''} : {})})); }
    else if (key === 'open_actions' || key === 'completed_actions') { setMode('followup'); change('action_status',key === 'completed_actions' ? 'Selesai' : ''); }
    else { setMode(key === 'checked_in' ? 'attendance' : key === 'assignments' ? 'schedule' : 'mapping'); if (key === 'linked_posts') change('mapping','linked'); }
    // Opening the applicable panel is the card action; no invented staffing threshold.
    requestAnimationFrame(() => { const node = document.getElementById(['reports','high_critical','unmapped_reports','open_actions','completed_actions'].includes(key) ? 'incident-history' : 'building-location-list'); node?.focus({ preventScroll: true }); node?.scrollIntoView({ block:'nearest' }); });
  };
  const visibleHotspots = viewData.hotspots.filter((h) => !filters.zone || filters.zone === h.id);
  const closeSheet = () => { setSheet(false); trigger.current?.focus?.({preventScroll:true}); };
  return <div className="building-workspace" data-building={building.id}>
    <div className="building-stage-layout">
    <section ref={stage} className="building-stage" aria-label={`Model interaktif ${building.name}`}>
      <div className="building-stage-header"><div><p className="building-eyebrow"><Box size={13} aria-hidden="true" /> EKSTERIOR INTERAKTIF</p><h2>{building.name}</h2><p>{building.features}</p></div><Button variant="ghost" aria-label="Paparan penuh" onClick={() => { const action = document.fullscreenElement ? document.exitFullscreen?.() : stage.current?.requestFullscreen?.(); action?.catch?.(() => {}); }}><Maximize2 size={17} /><span className="building-fullscreen-label">Paparan penuh</span></Button></div>
      <div className="building-canvas" data-model={building.modelId} aria-label={`Paparan 3D ${building.shortName}`}>
        {!supported || lost || error || !data ? <BuildingLoadingState error={!supported ? 'WebGL 2 tidak tersedia. Gunakan senarai lokasi untuk mengakses data operasi.' : lost ? 'Konteks grafik terputus. Muat semula paparan 3D.' : error} progress={progress} onRetry={onRetry} /> : <Canvas shadows frameloop="demand" dpr={buildingConfig.pixelRatio} camera={{ position: [180, 130, 220], fov: 40, near: .5, far: 3000 }} gl={{ antialias: true, powerPreference: 'high-performance' }} fallback={<BuildingLoadingState error="WebGL tidak tersedia dalam pelayar ini." onRetry={onRetry} />}>
          <color attach="background" args={[buildingConfig.background]} />
          <ambientLight intensity={1.4} />
          <hemisphereLight args={['#fff4db','#75846f',1.0]} />
          <directionalLight position={[-90, 160, 110]} intensity={2.2} castShadow shadow-autoUpdate={false} shadow-needsUpdate={true} shadow-mapSize={[1024, 1024]} shadow-camera-left={-140} shadow-camera-right={140} shadow-camera-top={140} shadow-camera-bottom={-140} shadow-camera-far={500} shadow-normalBias={.25} />
          <BuildingModel data={data} zone={filters.zone || selected} />
          {showHotspots && visibleHotspots.filter((item) => item.position).map((item) => <BuildingHotspot key={item.id} location={item} selected={selected === item.id} onSelect={select} indicator={locationIndicator(item.id)} occluders={data.occluders} count={mode === 'incidents' && !operations.overview.isError ? operations.overview.data?.locations.find((l) => l.hotspot_id === item.id)?.metrics?.incidents.total : undefined} />)}
          <CameraController data={data} selected={selected} command={command} />
          <ContextMonitor onLost={() => setLost(true)} />
        </Canvas>}
        <div className="building-stage-tools"><ViewerToolbar onReset={reset} onZoom={(direction) => setCommand((old) => ({ ...old, zoom: { direction } }))} showHotspots={showHotspots} hasHotspots={viewData.hotspots.some((item) => item.position)} onToggle={() => setShowHotspots((old) => !old)} /></div>
        <div className="building-stage-stamp" aria-live="polite"><span className={data ? 'is-ready' : ''} />{data ? 'Model sedia' : error || lost ? 'Model tidak tersedia' : 'Memuatkan model'}<small>{building.meshes} komponen · {building.region}</small></div>
      </div>
      <div className="building-camera-strip"><Field label="Pratetap kamera"><Select value={command.preset || 'selected'} onChange={(e) => setCommand((old) => ({...old,preset:e.target.value,reset:old.reset+1}))}>{Object.entries(cameraPresets).map(([key,label]) => <option key={key} value={key} disabled={key === 'selected' && !location?.position}>{label}</option>)}</Select></Field><p>Seret untuk putar · Skrol / cubit untuk zum<br /><span aria-live="polite">Pos dipilih: {location?.name || 'Tiada'}</span></p></div>
      <details open id="building-location-list" tabIndex={-1} className="building-post-list" aria-label="Pos keselamatan"><summary className="mb-3 cursor-pointer font-semibold">Pos keselamatan — {building.shortName}</summary>
        <p className="mb-3 text-xs">{building.postCount} pos rasmi · Kedudukan 3D belum disahkan. Pilih pos untuk melihat rekod operasi.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visibleHotspots.map((item) => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => select(item.id)} className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm ${selected === item.id ? 'app-nav-active' : 'app-button-ghost'}`}><span className="font-mono">{String(item.number).padStart(2, '0')}</span><span>{item.name}<small className="block text-secondary-token">{item.area} · {locationIndicator(item.id).text}</small></span></button>)}
        </div>
      </details>
    </section>
    <div ref={panel} tabIndex={-1} aria-label="Panel lokasi" data-sheet={sheet} className="building-info-panel" onKeyDown={(e) => { if (e.key === 'Escape') closeSheet(); }}><div className="building-record-header"><span>REKOD BANGUNAN</span><strong>{building.shortName}</strong><small>{building.postCount} pos rasmi · {building.region}</small></div><Button variant="ghost" className="building-sheet-close" onClick={closeSheet}>Tutup maklumat lokasi</Button><LocationInformationPanel location={location} operations={operations} /></div>
  </div>
  <section className="building-operations" aria-label="Data operasi bangunan"><div className="building-operations-heading"><div><p className="building-eyebrow">DATA & REKOD</p><h2>Operasi {building.shortName}</h2></div><p>Rekod pangkalan data mengikut bangunan dipilih.<br />Bukan pemantauan GPS atau ramalan insiden.</p></div>
    <OperationalToolbar period={period} setPeriod={setPeriod} mode={mode} setMode={setMode} operations={operations} />
    <AdvancedFilters data={viewData} filters={filters} change={change} mode={mode} operations={operations} period={period} setPeriod={setPeriod} onZone={onZone} reset={resetFilters} />
    {user?.nama_peranan === ROLE.admin && <LocationMappingPanel locations={operations.overview.data?.locations} userId={user.id_pengguna} building={building} />}
  <OperationalAnalytics query={operations.overview} mode={mode} onMetric={onMetric} />
  {(mode === 'incidents' || mode === 'followup') && <IncidentHistory key={JSON.stringify([building.id,period,filters,mode])} query={operations.incidents} page={page} setPage={setPage} onLocate={(id) => select(id,false)} zone={filters.zone} />}
  </section>
  </div>;
}

export function BuildingViewer({ building = getBuilding() }) {
  const [attempt, setAttempt] = useState(0);
  const [supported, setSupported] = useState(supportsWebGL);
  const retry = () => { setSupported(supportsWebGL()); setAttempt((value) => value + 1); };
  return <ViewerBoundary key={`${building.id}-${attempt}`} onRetry={retry}><LoadedViewer building={building} onRetry={retry} supported={supported} /></ViewerBoundary>;
}
