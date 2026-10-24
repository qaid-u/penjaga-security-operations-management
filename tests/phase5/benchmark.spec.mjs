import { test, expect } from '@playwright/test';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const label=process.env.PHASE5_BENCHMARK || 'after';
const median=(values)=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
async function login(page) {
  await page.goto('/login');await page.getByLabel('Nama pengguna').fill('demo_admin');await page.getByLabel('Kata laluan',{exact:true}).fill(process.env.PHASE5_DEMO_PASSWORD || 'Demo-Penjaga-2026!');await page.getByRole('button',{name:'Log Masuk',exact:true}).click();await expect(page).toHaveURL(/dashboard$/);
}
test('benchmark actual browser rendering and authenticated API latency',async({page,context,request})=>{
  test.setTimeout(180000);
  await page.addInitScript(()=>{
    window.__phase5Frames=0;window.__phase5Draws=0;
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=original.call(this,type,...args);if(type==='webgl2' && gl && !gl.__phase5Wrapped){gl.__phase5Wrapped=true;let binding=null;const bind=gl.bindFramebuffer.bind(gl);gl.bindFramebuffer=(target,buffer)=>{if(target===gl.FRAMEBUFFER || target===gl.DRAW_FRAMEBUFFER)binding=buffer;return bind(target,buffer);};const clear=gl.clear.bind(gl);gl.clear=(mask)=>{if(binding===null && (mask & gl.COLOR_BUFFER_BIT))window.__phase5Frames++;return clear(mask);};for(const name of ['drawElements','drawArrays']){const draw=gl[name].bind(gl);gl[name]=(...values)=>{window.__phase5Draws++;return draw(...values);};}}return gl;};
  });
  await login(page);
  const result={label,measured_at:new Date().toISOString(),conditions:{browser:'Edge Chromium headless',renderer:'SwiftShader software WebGL',network:'localhost without throttling',frame_counter:'default framebuffer color clears; offscreen shadow passes excluded',node:process.version,platform:process.platform,cpu:os.cpus()[0]?.model,logical_cpus:os.cpus().length},viewports:[],api:{}};
  const modelRequests=[];page.on('requestfinished',(r)=>{if(r.url().endsWith('.glb'))modelRequests.push(r.url());});
  for(const [name,width,height] of [['desktop',1440,1000],['mobile-emulated',390,844]]) {
    await page.setViewportSize({width,height});
    const started=performance.now();await page.goto('/3d-command-centre');await expect(page.locator('.building-hotspot')).toHaveCount(7);await page.locator('canvas').scrollIntoViewIfNeeded();
    const readyMs=performance.now()-started;
    const timing=await page.evaluate(()=>performance.getEntriesByType('resource').filter((r)=>r.name.endsWith('.glb')).map((r)=>({duration_ms:r.duration,transfer_bytes:r.transferSize,decoded_bytes:r.decodedBodySize,response_end:r.responseEnd})));
    const postDownloadReadyMs=await page.evaluate(()=>{const r=performance.getEntriesByType('resource').filter((r)=>r.name.endsWith('.glb')).at(-1);return r?performance.now()-r.responseEnd:null;});
    const canvas=page.locator('canvas');const box=await canvas.boundingBox();
    const sample=async(action)=>{
      const start=await page.evaluate(()=>({frames:window.__phase5Frames,draws:window.__phase5Draws,time:performance.now()}));
      await action();
      return page.evaluate((s)=>({duration_ms:performance.now()-s.time,rendered_frames:window.__phase5Frames-s.frames,draw_calls:window.__phase5Draws-s.draws,rendered_fps:(window.__phase5Frames-s.frames)/((performance.now()-s.time)/1000)}),start);
    };
    const orbit=await sample(async()=>{await page.mouse.move(box.x+box.width*.12,box.y+box.height*.18);await page.mouse.down();for(let i=0;i<30;i++){await page.mouse.move(box.x+box.width*(.12+i*.006),box.y+box.height*(.18+Math.sin(i*.1)*.04));await page.waitForTimeout(65);}await page.mouse.up();});
    const animation=await sample(async()=>{await page.getByRole('button',{name:/01.*Pintu Masuk Utama/}).click();await page.waitForTimeout(1300);});
    const selectionStart=performance.now();await page.getByRole('button',{name:/03.*Sayap Kiri/}).click();await expect(page.getByRole('heading',{name:'DEMO Pos B'})).toBeVisible();
    const selectionMs=performance.now()-selectionStart;
    result.viewports.push({name,width,height,route_to_model_ready_ms:readyMs,glb_resources:timing,download_to_ready_upper_bound_ms:postDownloadReadyMs,orbit,animation,selection_to_data_panel_ms:selectionMs});
  }
  await page.setViewportSize({width:1440,height:1000});
  const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');const heapBefore=await cdp.send('Runtime.getHeapUsage');
  const completedBefore=modelRequests.length;
  for(let i=0;i<4;i++){await page.getByRole('link',{name:'Jadual Bertugas',exact:true}).click();await expect(page).toHaveURL(/jadual$/);await page.getByRole('link',{name:'Pusat Kawalan 3D',exact:true}).click();await expect(page.locator('.building-hotspot')).toHaveCount(7);}
  await cdp.send('HeapProfiler.collectGarbage');const heapAfter=await cdp.send('Runtime.getHeapUsage');
  result.repeated_navigation={cycles:4,additional_completed_glb_requests:modelRequests.length-completedBefore,js_heap_before_bytes:heapBefore.usedSize,js_heap_after_bytes:heapAfter.usedSize,js_heap_delta_bytes:heapAfter.usedSize-heapBefore.usedSize};
  const loginResponse=await request.post('http://127.0.0.1:3095/api/auth/login',{data:{username:'demo_admin',password:process.env.PHASE5_DEMO_PASSWORD || 'Demo-Penjaga-2026!'}});expect(loginResponse.ok()).toBe(true);const {token}=await loginResponse.json();
  for(const endpoint of ['/3d/overview?date=2026-10-24&from=2026-09-25&to=2026-10-24&mapping=all','/3d/locations/1/summary?date=2026-10-24&from=2026-09-25&to=2026-10-24&mapping=all','/3d/incidents?from=2026-09-25&to=2026-10-24&mapping=all','/dashboard']) {
    const times=[];for(let i=0;i<7;i++){const start=performance.now();const response=await request.get(`http://127.0.0.1:3095/api${endpoint}`,{headers:{Authorization:`Bearer ${token}`}});expect(response.ok()).toBe(true);await response.body();times.push(performance.now()-start);}result.api[endpoint]={samples:times,median_ms:median(times),min_ms:Math.min(...times),max_ms:Math.max(...times)};
  }
  const bytes=await readFile('public/models/Bangunan_SUK.glb');const parse=[];let scene;
  for(let i=0;i<5;i++){const start=performance.now();const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');parse.push(performance.now()-start);scene=gltf.scene;}
  let meshes=0,triangles=0;const materials=new Set();scene.traverse((o)=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count || o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  result.asset={bytes:bytes.length,meshes,triangles,distinct_materials:materials.size,node_parse_median_ms:median(parse),node_parse_samples_ms:parse};
  await mkdir('docs/psm-evaluation/evidence',{recursive:true});await writeFile(`docs/psm-evaluation/evidence/performance-${label}.json`,JSON.stringify(result,null,2));
});
