// Public model bytes only. Parsed scenes stay component-owned and are always disposed.
const requests = new Map();
const maxCachedBytes = 16 * 1024 * 1024;
export function acquireBuildingBytes(url, { timeoutMs = 60000, onProgress = () => {} } = {}) {
  let entry=requests.get(url);
  if(!entry) {
    const controller=new AbortController();
    entry={controller,listeners:new Set(),settled:false,progress:null};
    requests.set(url,entry);
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    entry.promise=(async()=>{
      const response=await fetch(url,{signal:controller.signal});
      if(!response.ok)throw new Error(`Fail model tidak tersedia (HTTP ${response.status}).`);
      const total=Number(response.headers.get('content-length'));
      const reader=response.body.getReader();let received=0;const chunks=[];
      while(true){const {value,done}=await reader.read();if(done)break;chunks.push(value);received+=value.length;entry.progress=total?Math.min(99,received/total*100):null;entry.listeners.forEach((listener)=>listener(entry.progress));}
      const bytes=new Uint8Array(received);let offset=0;chunks.forEach((chunk)=>{bytes.set(chunk,offset);offset+=chunk.length;});
      if(bytes.byteLength<12 || new DataView(bytes.buffer).getUint32(0,true)!==0x46546c67)throw new Error('Fail yang diterima bukan GLB yang sah.');
      entry.settled=true;
      if(bytes.byteLength>maxCachedBytes)requests.delete(url);
      for(const [key,other] of requests)if(key!==url && other.settled)requests.delete(key);
      return bytes.buffer;
    })().catch((error)=>{requests.delete(url);throw error;}).finally(()=>clearTimeout(timer));
  }
  clearTimeout(entry.expiry);clearTimeout(entry.abortTimer);
  entry.listeners.add(onProgress);onProgress(entry.progress);
  return {promise:entry.promise,release(){entry.listeners.delete(onProgress);if(entry.listeners.size)return;
    // StrictMode's immediate effect remount reuses the in-flight download.
    entry.abortTimer=setTimeout(()=>{if(!entry.listeners.size && !entry.settled){entry.controller.abort();requests.delete(url);}},0);
    entry.expiry=setTimeout(()=>{if(!entry.listeners.size && requests.get(url)===entry)requests.delete(url);},300000);
  }};
}
