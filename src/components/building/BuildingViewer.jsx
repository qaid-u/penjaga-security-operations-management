import { Component, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { buildingConfig } from './buildingConfig';
import { useBuildingAsset } from './useBuildingAsset';
import { BuildingModel } from './BuildingModel';
import { BuildingHotspot } from './BuildingHotspot';
import { CameraController } from './CameraController';
import { BuildingLoadingState } from './BuildingLoadingState';
import { ViewerToolbar } from './ViewerToolbar';
import { LocationInformationPanel } from './LocationInformationPanel';

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

function LoadedViewer({ onRetry }) {
  const { data, progress, error } = useBuildingAsset(buildingConfig.modelUrl);
  const [selected, setSelected] = useState(null);
  const [showHotspots, setShowHotspots] = useState(true);
  const [lost, setLost] = useState(false);
  const [command, setCommand] = useState({ reset: 0, zoom: null });
  if (error || !data) return <BuildingLoadingState error={error} progress={progress} onRetry={onRetry} />;
  const location = data.hotspots.find((item) => item.id === selected);
  const select = (id) => { setSelected(id); setCommand((old) => ({ ...old, reset: old.reset + 1 })); };
  const reset = () => { setSelected(null); setCommand((old) => ({ ...old, reset: old.reset + 1 })); };
  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
    <section className="app-surface min-w-0 overflow-hidden rounded-2xl border" aria-label="Model interaktif Bangunan SUK">
      <ViewerToolbar onReset={reset} onZoom={(direction) => setCommand((old) => ({ ...old, zoom: { direction } }))} showHotspots={showHotspots} onToggle={() => setShowHotspots((old) => !old)} />
      <div className="building-canvas">
        {lost ? <BuildingLoadingState error="Konteks grafik terputus. Muat semula paparan 3D." onRetry={onRetry} /> : <Canvas shadows frameloop="demand" dpr={buildingConfig.pixelRatio} camera={{ position: [180, 130, 220], fov: 40, near: .5, far: 3000 }} gl={{ antialias: true, powerPreference: 'high-performance' }} fallback={<BuildingLoadingState error="WebGL tidak tersedia dalam pelayar ini." onRetry={onRetry} />}>
          <color attach="background" args={[buildingConfig.background]} />
          <ambientLight intensity={1.7} />
          <directionalLight position={[80, 140, 100]} intensity={2.7} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-110} shadow-camera-right={110} shadow-camera-top={110} shadow-camera-bottom={-110} shadow-camera-far={400} shadow-normalBias={.25} />
          <BuildingModel data={data} />
          {showHotspots && data.hotspots.filter((item) => item.position).map((item) => <BuildingHotspot key={item.id} location={item} selected={selected === item.id} onSelect={select} />)}
          <CameraController data={data} selected={selected} command={command} />
          <ContextMonitor onLost={() => setLost(true)} />
        </Canvas>}
      </div>
      <p className="border-t px-4 py-3 text-xs">Seret untuk putar · Skrol / cubit untuk zum · Seret kanan / dua jari untuk alih</p>
      <div className="border-t p-4"><h3 className="mb-3">Lokasi bangunan</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {data.hotspots.map((item) => <button key={item.id} type="button" disabled={!item.position || lost} aria-pressed={selected === item.id} onClick={() => select(item.id)} className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-50 ${selected === item.id ? 'app-nav-active' : 'app-button-ghost'}`}><span className="font-mono">{String(item.number).padStart(2, '0')}</span>{item.name}{!item.position && ' — penanda tiada'}</button>)}
        </div>
      </div>
    </section>
    <LocationInformationPanel location={location} />
  </div>;
}

export function BuildingViewer() {
  const [attempt, setAttempt] = useState(0);
  const [supported, setSupported] = useState(supportsWebGL);
  const retry = () => { setSupported(supportsWebGL()); setAttempt((value) => value + 1); };
  if (!supported) return <BuildingLoadingState error="WebGL 2 tidak tersedia. Aktifkan pecutan perkakasan atau gunakan pelayar yang menyokong WebGL 2." onRetry={retry} />;
  return <ViewerBoundary key={attempt} onRetry={retry}><LoadedViewer onRetry={retry} /></ViewerBoundary>;
}
