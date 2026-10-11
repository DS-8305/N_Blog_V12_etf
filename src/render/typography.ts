import sharp, { type OverlayOptions } from 'sharp';
import { writeFile } from 'node:fs/promises';
import { sha256 } from '../editorial/fingerprint.js';
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export interface CardLine {text:string;size?:number;color?:string;gap?:number;barPercent?:number}
export async function renderCard(path:string,lines:CardLine[]):Promise<{width:number;height:number;sha256:string}>{
 let top=64;const layers:OverlayOptions[]=[];
 for(const line of lines){
  const size=line.size??30;
  const {data,info}=await sharp({text:{text:'<span foreground="'+(line.color??'#163047')+'">'+escape(line.text)+'</span>',font:(process.env.ETF_CARD_FONT??'Malgun Gothic')+' '+size,width:1060,wrap:'word-char',rgba:true,dpi:72}}).png().toBuffer({resolveWithObject:true});
  if(top+info.height>1136)throw Error('needs_user:text_layout_overflow');
  layers.push({input:data,left:70,top});top+=info.height+(line.gap??18);
  if(line.barPercent!==undefined){const w=Math.round(1060*line.barPercent/100);layers.push({input:Buffer.from('<svg width="1060" height="14"><rect width="1060" height="14" rx="7" fill="#dce8ef"/><rect width="'+w+'" height="14" rx="7" fill="#347da1"/></svg>'),left:70,top});top+=36;}
 }
 const bytes=await sharp({create:{width:1200,height:1200,channels:4,background:'#f4f8fb'}}).composite(layers).png().toBuffer();
 await writeFile(path,bytes);return {width:1200,height:1200,sha256:sha256(bytes)};
}
export const numberText=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(n);
