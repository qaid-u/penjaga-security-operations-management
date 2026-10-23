import { MapPin } from 'lucide-react';
import { Badge, Button, Card } from '../ui';

export function LocationInformationPanel({ location }) {
  return <Card title="Maklumat Lokasi" className="h-fit" >
    <div aria-live="polite" aria-atomic="true">
      {!location ? <div className="space-y-3 py-5"><MapPin size={30} className="text-[#002B5B]" /><h3>Pilih lokasi bangunan</h3><p>Pilih penanda pada model atau senarai lokasi untuk memfokuskan kamera dan melihat maklumat demonstrasi.</p></div> : <>
        <Badge>Data demonstrasi</Badge><h3 className="mt-4 text-lg">{location.name}</h3><p className="mt-2">{location.description}</p>
        <dl className="mt-5 space-y-3 text-sm">
          {Object.entries({ Bahagian: location.section, 'Aras / kawasan': location.area, 'Status demo': location.demo.status, 'Pengawal demo': location.demo.guard, 'Syif demo': location.demo.shift, 'Insiden demo': location.demo.incidents }).map(([key, value]) => <div key={key} className="border-b pb-2"><dt className="text-tertiary-token">{key}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
        </dl>
      </>}
    </div>
    {location && <div className="mt-5 space-y-2">
      {['Lihat Jadual', 'Lihat Laporan', 'Butiran Lokasi'].map((label) => <Button key={label} disabled variant="ghost" className="w-full" aria-describedby="phase3-note">{label}</Button>)}
      <p id="phase3-note" className="text-xs">Integrasi pangkalan data lokasi dirancang untuk Fasa 3. Data ini bukan maklumat operasi sebenar.</p>
    </div>}
  </Card>;
}
