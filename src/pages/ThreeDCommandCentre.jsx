import { Badge, PageHeader } from '../components/ui';
import { BuildingViewer } from '../components/building/BuildingViewer';
import '../components/building/building.css';

export default function ThreeDCommandCentre() {
  return <div className="space-y-5">
    <PageHeader title="Pusat Kawalan Keselamatan 3D" description="Visualisasi Interaktif Bangunan SUK" action={<Badge>Fasa 2 · Demonstrasi</Badge>} />
    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Model eksterior anggaran untuk prototaip akademik. Semua maklumat penugasan ialah data demo; tiada pemantauan langsung.</p>
    <BuildingViewer />
  </div>;
}
