import { Badge, PageHeader } from '../components/ui';
import { BuildingViewer } from '../components/building/BuildingViewer';
import '../components/building/building.css';

export default function ThreeDCommandCentre() {
  return <div className="space-y-5">
    <PageHeader title="Pusat Kawalan Keselamatan 3D" description="Navigasi zon, sejarah laporan & analitik operasi Bangunan SUK" action={<Badge>Fasa 4 · Analitik operasi</Badge>} />
    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Model eksterior anggaran. Data operasi bersumberkan rekod pangkalan data yang dipautkan oleh pentadbir; bukan pemantauan GPS, lokasi fizikal pengawal atau ramalan insiden.</p>
    <BuildingViewer />
  </div>;
}
