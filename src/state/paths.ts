import { realpath } from 'node:fs/promises';
import { resolve,relative,isAbsolute } from 'node:path';
export async function safeJobFile(job:string,path:string):Promise<string>{
 if(isAbsolute(path)||/^[A-Za-z]:/.test(path)||path.startsWith('\\'))throw Error('outside_job');
 const root=await realpath(job),candidate=resolve(root,path),rel=relative(root,candidate);
 if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('outside_job');
 // Realpath also blocks a symlink/junction leading out of the workspace.
 const actual=await realpath(candidate),actualRel=relative(root,actual);
 if(actualRel.startsWith('..')||isAbsolute(actualRel))throw Error('outside_job');
 return actual;
}
