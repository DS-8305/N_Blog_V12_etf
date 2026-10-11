import { join } from 'node:path';
import type { Locator,Page } from 'playwright';
import type { OwnedSession } from '../browser/session.js';
import type { PreparedDraft } from '../domain/bundle.js';
import type { DraftReceipt,ImageReceipt } from './receipts.js';
import { pageImagePort,isEvidenceImage,type ImageObservation } from './imageUploader.js';
import { firstVisible,getEditorFrame,assertNoExistingDraft } from './editorHelpers.js';
import { selectors,NAVER_BLOG_WRITE_URL } from './selectors.js';
import { readJson } from '../state/jsonStore.js';
export interface EditorSnapshot {title:string;bodyText:string;images:ImageObservation[]}
export interface DraftEvidence extends EditorSnapshot {beforeCount:number;receipts:ImageReceipt[]}
const normalized=(text:string)=>text.normalize('NFC').replace(/\s+/g,'');
function imageResource(src:string):string{const url=new URL(src);if(url.hostname.endsWith('.pstatic.net'))url.search='';return url.href;}
export function matchesDraftEvidence(expected:PreparedDraft,proof:DraftEvidence,current:EditorSnapshot):boolean{
 if(normalized(current.title)!==normalized(expected.title)||normalized(current.bodyText)!==normalized(expected.expected.bodyText)||proof.receipts.length!==expected.expected.imageAssetIds.length||current.images.length!==proof.images.length||current.images.length!==expected.expected.imageAssetIds.length)return false;
 for(const [i,id]of expected.expected.imageAssetIds.entries()){
  const receipt=proof.receipts[i],actual=current.images[i],recorded=proof.images[i],asset=expected.assets.find(a=>a.assetId===id);
  if(!receipt||!actual||!recorded||!asset||receipt.assetId!==id||receipt.index!==i||!actual.loaded||!isEvidenceImage(actual.src)||!isEvidenceImage(recorded.src)||imageResource(actual.src)!==imageResource(recorded.src)||Math.abs(actual.width/actual.height-asset.width/asset.height)>0.02)return false;
 }
 return expected.expected.captions.every(c=>normalized(current.bodyText).includes(normalized(c)))&&expected.expected.sources.every(source=>current.bodyText.includes(source));
}
export async function readEditorSnapshot(page:Page):Promise<EditorSnapshot>{
 const title=await firstVisible(page,selectors.title),frame=await getEditorFrame(page);
 const texts=await frame.locator('.se-components-wrap .se-text-paragraph').evaluateAll(elements=>elements.filter(e=>!e.closest('.se-title-text,.se-section-documentTitle')).map(e=>[...e.querySelectorAll('.__se-node')].map(n=>(n as HTMLElement).innerText).join('')));
 return {title:(await title.innerText()).trim(),bodyText:texts.join('\n'),images:await pageImagePort(page).read()};
}
export async function readDraftCount(page:Page):Promise<number|null>{
 for(const frame of page.frames()){const locator=frame.locator(selectors.draftCount);for(let i=0;i<await locator.count();i++){const item=locator.nth(i);if(await item.isVisible()){const text=(await item.innerText()).trim();if(/^\d+$/.test(text))return Number(text);}}}return null;
}
async function matchingSavedRows(page:Page,title:string):Promise<Locator[]>{
 const rows:Locator[]=[];
 for(const frame of page.frames()){
  const found=frame.locator('button[data-click-area="tpb*s.tlist"]').filter({has:frame.getByText(title,{exact:true})});
  for(let i=0;i<await found.count();i++)if(await found.nth(i).isVisible())rows.push(found.nth(i));
 }
 return rows;
}
export async function confirmDraft(session:OwnedSession,expected:PreparedDraft):Promise<DraftReceipt|null>{
 // A fresh Naver editor can return an empty document on the first saved-row open.
 // Repeat only the read/reopen verification, never input or save dispatch.
 const first=await confirmDraftOnce(session,expected);
 return first??await confirmDraftOnce(session,expected);
}
async function confirmDraftOnce(session:OwnedSession,expected:PreparedDraft):Promise<DraftReceipt|null>{
 const proof=await readJson(join(expected.jobPath,'input-proof.json')) as DraftEvidence;
 if(!proof||!Array.isArray(proof.images)||!Array.isArray(proof.receipts))return null;
 const page=session.editorPage;await page.bringToFront();
 if(!page.url().includes('blog.naver.com'))await page.goto(NAVER_BLOG_WRITE_URL,{waitUntil:'domcontentloaded'});
 await assertNoExistingDraft(page);
 const countDeadline=Date.now()+8000;let count:number|null;
 do{count=await readDraftCount(page);if(count!==null&&count>proof.beforeCount)break;await page.waitForTimeout(150);}while(Date.now()<countDeadline);
 if(count===null||count<=proof.beforeCount)return null;
 let rows=await matchingSavedRows(page,expected.title);
 if(!rows.length)await(await firstVisible(page,[selectors.draftCount],5000)).click();
 const listDeadline=Date.now()+5000;
 do{rows=await matchingSavedRows(page,expected.title);if(rows.length)break;await page.waitForTimeout(100);}while(Date.now()<listDeadline);
 if(rows.length!==1)return null;
 if(await rows[0]!.locator('..').locator('span[class*="current_post"]').isVisible()){
  // A current row does not load persisted content when clicked. Read afresh.
  await page.keyboard.press('Escape');
  await page.reload({waitUntil:'domcontentloaded'});
  await assertNoExistingDraft(page);
  rows=await matchingSavedRows(page,expected.title);
  if(!rows.length)await(await firstVisible(page,[selectors.draftCount],5000)).click();
  const freshListDeadline=Date.now()+5000;
  do{rows=await matchingSavedRows(page,expected.title);if(rows.length)break;await page.waitForTimeout(100);}while(Date.now()<freshListDeadline);
  if(rows.length!==1||await rows[0]!.locator('..').locator('span[class*="current_post"]').isVisible())return null;
 }
 const row=rows[0]!,listText=await row.innerText();await row.click();
 const reopenDeadline=Date.now()+8000;
 do{
  await assertNoExistingDraft(page);
  if(!(await matchingSavedRows(page,expected.title)).length){
   const current=await readEditorSnapshot(page);
   if(matchesDraftEvidence(expected,proof,current)){
    return {jobId:expected.jobId,fingerprint:expected.fingerprint,title:current.title,bodyText:current.bodyText,confirmedAt:new Date().toISOString(),imageAssetIds:expected.expected.imageAssetIds,captions:expected.expected.captions,sources:expected.expected.sources,identity:{listText,reopenedUrl:page.url()}};
   }
  }
  await page.waitForTimeout(150);
 }while(Date.now()<reopenDeadline);
 return null;
}
