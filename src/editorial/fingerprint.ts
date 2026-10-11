import { createHash } from 'node:crypto';
export function canonical(value:unknown):string{if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b,'en')).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value);}
export function fingerprint(value:unknown):string{return createHash('sha256').update(canonical(value)).digest('hex');}
export function sha256(bytes:Buffer):string{return createHash('sha256').update(bytes).digest('hex');}
