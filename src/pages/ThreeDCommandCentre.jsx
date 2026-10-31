import { useSearchParams } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Box, MapPin, ArrowUpRight } from 'lucide-react';
import { BuildingViewer } from '../components/building/BuildingViewer';
import { modeledBuildings, getBuilding } from '../components/building/buildingModels';
import { ReportEventContext } from '../components/building/ReportEventContext';
import '../components/building/building.css';

export default function ThreeDCommandCentre() {
  const [params, setParams] = useSearchParams();
  const building = getBuilding(params.get('building') || 'DJM');
  const initialPost = building.hotspots.some(post => post.id === params.get('post')) ? params.get('post') : null;
  const gallery = useRef(null);
  useEffect(() => { const selected = gallery.current?.querySelector('[aria-pressed="true"]'); if (selected?.getClientRects().length) selected.scrollIntoView({ block:'nearest', inline:'nearest' }); }, [building.id]);
  const choose = (id) => setParams({ building: id });
  return <div className="building-library">
    <header className="building-library-header">
      <div><p className="building-eyebrow"><Box size={14} aria-hidden="true" /> PAPARAN SPATIAL</p><h1>Pusat Kawalan Keselamatan 3D</h1><p>Terokai eksterior, pilih pos dan semak rekod operasi setiap bangunan.</p></div>
      <label className="building-select"><span>Pilih bangunan</span><select aria-label="Pilih bangunan" value={building.id} onChange={(event) => choose(event.target.value)}>{modeledBuildings.map((item) => <option key={item.id} value={item.id}>{item.shortName}</option>)}</select></label>
    </header>
    <details className="workspace-disclosure"><summary>Galeri bangunan <small>Lihat semua pilihan bangunan</small></summary>
    <div ref={gallery} className="building-gallery" role="group" aria-label="Pilihan bangunan 3D">
      {modeledBuildings.map((item, index) => <button type="button" key={item.id} onClick={() => choose(item.id)} aria-label={`Lihat ${item.name}`} aria-pressed={item.id === building.id} className={`building-gallery-card ${item.id === building.id ? 'is-active' : ''}`} style={{ '--building-accent': item.accent }}>
        <span className="building-gallery-number">{String(index+1).padStart(2,'0')}</span><img src={item.previewUrl} alt="" decoding="async" loading="lazy" /><span className="building-gallery-label">{item.shortName}<small>{item.postCount} pos · {item.region}</small></span><ArrowUpRight className="building-gallery-arrow" size={15} aria-hidden="true" />
      </button>)}
    </div>
    </details>
    <div className="building-context-line"><span><MapPin size={13} aria-hidden="true" /> {building.region}</span><span>8 bangunan · 6 model eksterior</span>{building.sharedWith && <span>Model dikongsi · rekod bangunan berasingan</span>}<span className="building-context-note">Eksterior anggaran · Kedudukan dalaman pos belum disahkan</span></div>
    <ReportEventContext report={params.get('report')} event={params.get('event')} building={building} post={initialPost} />
    <BuildingViewer key={`${building.id}:${initialPost || ''}`} building={building} initialPost={initialPost} />
  </div>;
}
