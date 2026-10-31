import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Box, MapPin } from 'lucide-react';
import { modeledBuildings } from './buildingModels';
import './model-showcase.css';

export function ModelShowcase({compact=false}) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState('DJM');
  const selected = modeledBuildings.find((building) => building.id === selectedId) || modeledBuildings[0];
  if (!selected) return null;
  const modelCount = new Set(modeledBuildings.map((building) => building.modelId)).size;
  const open = () => navigate(`/3d-command-centre?building=${encodeURIComponent(selected.id)}`);

  return <section className={`model-showcase ${compact ? 'ops-model-compact' : ''}`} aria-label="Terokai portfolio bangunan 3D">
    <div className="model-showcase__intro">
      <div className="model-showcase__eyebrow"><Box size={16} aria-hidden="true" /><span>PENJAGA / PERSPEKTIF 3D</span></div>
      <h2>Terokai bangunan.<br /><span>Fahami operasi.</span></h2>
      <p className="model-showcase__description">Lihat model bangunan anda, pilih pos keselamatan dan semak rekod operasi dalam satu paparan.</p>
      <div className="model-showcase__numbers" aria-label={`${modeledBuildings.length} bangunan, ${modelCount} model eksterior`}>
        <div><strong>{String(modeledBuildings.length).padStart(2, '0')}</strong><span>Bangunan</span></div>
        <div><strong>{String(modelCount).padStart(2, '0')}</strong><span>Model eksterior</span></div>
      </div>
      <button type="button" className="model-showcase__cta" onClick={open}>Buka pusat kawalan 3D <ArrowUpRight size={18} aria-hidden="true" /></button>
      <p className="model-showcase__footnote">Model eksterior anggaran. Kedudukan dalaman pos belum disahkan.</p>
    </div>

    <div className="model-showcase__portfolio" style={{ '--model-accent': selected.accent || '#0f766e' }}>
      <div className="model-showcase__stage">
        <div className="model-showcase__stage-top"><span className="model-showcase__pill"><span aria-hidden="true" /> MODEL BANGUNAN</span><span className="model-showcase__index">{String(modeledBuildings.findIndex((building) => building.id === selected.id) + 1).padStart(2, '0')} / {String(modeledBuildings.length).padStart(2, '0')}</span></div>
        <button type="button" className="model-showcase__preview" onClick={open} aria-label={`Buka model 3D ${selected.name}`}>
          <img key={selected.id} src={selected.previewUrl} alt={`Model eksterior ${selected.name}`} className="model-showcase__image" decoding="async" loading="lazy" />
          <span className="model-showcase__preview-action"><Box size={15} aria-hidden="true" /> Terokai 3D <ArrowUpRight size={16} aria-hidden="true" /></span>
        </button>
        <div className="model-showcase__caption" aria-live="polite">
          <div><span className="model-showcase__region"><MapPin size={12} aria-hidden="true" />{selected.region}</span><h3>{selected.shortName}</h3><p>{selected.name}</p></div>
          <span className="model-showcase__post-count"><strong>{selected.postCount}</strong> pos rasmi</span>
        </div>
      </div>
      <div className="model-showcase__rail" role="group" aria-label="Pilih pratonton bangunan">
        {modeledBuildings.map((building, index) => <button type="button" key={building.id} className={`model-showcase__tile ${selected.id === building.id ? 'is-selected' : ''}`} aria-pressed={selected.id === building.id} aria-label={`Pratonton ${building.name}`} onClick={() => setSelectedId(building.id)}>
          <span className="model-showcase__tile-number">{String(index + 1).padStart(2, '0')}</span>
          <img src={building.previewUrl} alt="" loading="lazy" decoding="async" />
          <span className="model-showcase__tile-label">{building.shortName}</span>
          {building.sharedWith && <span className="model-showcase__shared">Model dikongsi</span>}
        </button>)}
      </div>
    </div>
  </section>;
}
