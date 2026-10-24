function referencesAttachment(value, expected) {
  if (typeof value !== 'string') return false;
  try {const parsed=JSON.parse(value);return Array.isArray(parsed) ? parsed.some((item)=>item===expected) : parsed===expected;}
  catch {return value===expected;}
}
function evidenceMime(header) {
  if(header.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(header[0]===0xff && header[1]===0xd8 && header[2]===0xff)return 'image/jpeg';
  if(header.toString('ascii',0,4)==='RIFF' && header.toString('ascii',8,12)==='WEBP')return 'image/webp';
  if(header.toString('ascii',0,5)==='%PDF-')return 'application/pdf';
  return 'application/octet-stream';
}
module.exports={referencesAttachment,evidenceMime};
