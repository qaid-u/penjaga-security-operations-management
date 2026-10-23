import { Html } from '@react-three/drei';

export function BuildingHotspot({ location, selected, onSelect }) {
  return <Html position={location.position} center zIndexRange={[20, 1]} style={{ pointerEvents: 'none' }}>
    <button type="button" className={`building-hotspot ${selected ? 'is-selected' : ''}`} aria-label={`Pilih ${location.name}`} aria-pressed={selected} title={location.name} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect(location.id); }}>
      {location.number}<span className="building-hotspot-label">{location.name}</span>
    </button>
  </Html>;
}
