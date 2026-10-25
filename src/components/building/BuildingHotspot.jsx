import { Html } from '@react-three/drei';
import { useRef } from 'react';
import { Vector3 } from 'three';
import { markerPosition } from './postPlacements';
import { projectedMarkerLayout, updateMarkerLeader } from './markerLayout';

export function BuildingHotspot({ location, locations, selected, onSelect, indicator, occluders, count }) {
  const leader = useRef(null);
  const estimated = !location.position && location.placement?.status === 'estimated';
  const calculatePosition = (object, camera, size) => {
    let point = projectedMarkerLayout(camera, size, locations || [location]).get(location.id);
    if (!point) {
      const projected = new Vector3().setFromMatrixPosition(object.matrixWorld).project(camera);
      const anchor = { x:(projected.x+1)*size.width/2, y:(1-projected.y)*size.height/2 };
      point = { anchor, position:anchor };
    }
    const { anchor, position } = point;
    updateMarkerLeader(leader.current, anchor, position);
    return [position.x, position.y];
  };
  return <Html position={markerPosition(location)} center calculatePosition={calculatePosition} occlude={estimated ? false : occluders} zIndexRange={[20, 1]} style={{ pointerEvents: 'none' }}>
    <svg className="building-marker-leader" aria-hidden="true"><line ref={leader} x1="0" y1="0" x2="0" y2="0" /></svg>
    <button type="button" style={{ '--marker-color': indicator?.color }} data-placement={estimated ? 'estimated' : 'verified'} className={`building-hotspot ${estimated ? 'is-estimated' : ''} ${selected ? 'is-selected' : ''}`} aria-label={`Pilih ${location.name}${estimated ? ' (anggaran)' : ''}`} aria-description={estimated ? 'Anggaran visual, keyakinan rendah. Kedudukan sebenar belum disahkan.' : indicator?.text} aria-pressed={selected} title={`${location.name}${estimated ? ' — Anggaran visual, belum disahkan' : ''}: ${indicator?.text || ''}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect(location.id); }}>
      {location.number}{estimated && <span className="building-estimate-tag">Anggaran</span>}{count !== undefined && <span className="building-count" aria-label={`${count} laporan`}>{count}</span>}<span className="building-hotspot-label">{location.name}{estimated && <small>Anggaran visual · Keyakinan rendah</small>}{indicator?.text}</span>
    </button>
  </Html>;
}
