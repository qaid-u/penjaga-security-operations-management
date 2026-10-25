import { Button } from '../ui';

export function BuildingLoadingState({ error, progress, onRetry }) {
  return <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 p-6 text-center" role={error ? 'alert' : 'status'}>
    <h2>{error ? 'Paparan 3D tidak tersedia' : 'Memuatkan model bangunan'}</h2>
    <p>{error || 'Menyediakan model dan bahan paparan...'}</p>
    {!error && <><progress aria-label="Kemajuan muat turun model" max="100" value={progress ?? undefined} className="h-2 w-56 accent-[#002B5B]" /><span>{progress === null ? 'Memuat turun...' : `${Math.round(progress)}%`}</span></>}
    {error && <Button onClick={onRetry}>Cuba lagi</Button>}
  </div>;
}
