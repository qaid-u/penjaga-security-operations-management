import { Html } from '@react-three/drei';

export function BuildingHotspot({ location, selected, onSelect, indicator, occluders, count }) {
  return <Html position={location.position} center occlude={occluders} zIndexRange={[20, 1]} style={{ pointerEvents: 'none' }}>
    <button type="button" style={{ '--marker-color': indicator?.color }} className={`building-hotspot ${selected ? 'is-selected' : ''}`} aria-label={`Pilih ${location.name}`} aria-description={indicator?.text} aria-pressed={selected} title={`${location.name}: ${indicator?.text || ''}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect(location.id); }}>
      {location.number}{count !== undefined && <span className="building-count" aria-label={`${count} laporan`}>{count}</span>}<span className="building-hotspot-label">{location.name}: {indicator?.text}</span>
    </button>
  </Html>;
}
