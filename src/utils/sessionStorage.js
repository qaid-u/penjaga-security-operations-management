export function readStoredUser(storage = localStorage) {
  try {
    const value=JSON.parse(storage.getItem('penjaga_user') || 'null');
    if(value === null) return null;
    if(typeof value !== 'object' || Array.isArray(value) || typeof value.nama_peranan !== 'string') throw new Error('Invalid saved identity');
    return value;
  } catch {
    storage.removeItem('penjaga_user');storage.removeItem('token');return null;
  }
}
