import { RotateCcw, Plus, Minus, MapPin } from 'lucide-react';
import { Button } from '../ui';

export function ViewerToolbar({ onReset, onZoom, showHotspots, onToggle }) {
  return <div className="flex flex-wrap gap-2 border-b p-3" role="group" aria-label="Kawalan kamera">
    <Button variant="ghost" onClick={onReset}><RotateCcw size={16} /> Tetap semula</Button>
    <Button variant="ghost" aria-label="Zum masuk" onClick={() => onZoom(1)}><Plus size={18} /></Button>
    <Button variant="ghost" aria-label="Zum keluar" onClick={() => onZoom(-1)}><Minus size={18} /></Button>
    <Button variant="ghost" aria-pressed={showHotspots} onClick={onToggle}><MapPin size={16} /> Penanda</Button>
  </div>;
}
