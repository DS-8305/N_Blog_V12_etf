import { chromium,type Browser,type BrowserContext,type Page } from 'playwright';
import { findOwnedPage } from './ownedPage.js';
import { acquireBrowserLocks,normalizeEndpoint } from './runLock.js';
import { NAVER_HOME_URL } from '../automation/selectors.js';
export interface SessionOptions {cdpEndpoint:string;profilePath:string;jobId:string;editorTargetId?:string}
export interface OwnedSession {browser:Browser;context:BrowserContext;editorPage:Page;collectorPages:Page[];release(options?:{keepEditorOpen:boolean}):Promise<void>}
export interface OwnedCollectionSession {browser:Browser;context:BrowserContext;pages:Page[];newPage():Promise<Page>;release():Promise<void>}
type Dependencies={connect:(endpoint:string)=>Promise<Browser>;lock:(endpoint:string,profile:string)=>Promise<()=>Promise<void>>};
const defaults:Dependencies={connect:endpoint=>chromium.connectOverCDP(endpoint,{timeout:30000}),lock:acquireBrowserLocks};
async function connectOwned(options:SessionOptions,deps:Dependencies){
 const endpoint=normalizeEndpoint(options.cdpEndpoint),unlock=await deps.lock(endpoint,options.profilePath);let browser:Browser|undefined;
 try{browser=await deps.connect(endpoint);const context=browser.contexts()[0];if(!context)throw Error('cdp_context_missing');return {browser,context,unlock};}
 catch(error){await browser?.close();await unlock();throw error;}
}
export async function openEditorSession(options:SessionOptions,deps:Dependencies=defaults):Promise<OwnedSession>{
 const owned=await connectOwned(options,deps);let editorPage:Page;
 try{editorPage=options.editorTargetId?await findOwnedPage(owned.context,options.editorTargetId):await owned.context.newPage();if(!options.editorTargetId)await editorPage.goto(NAVER_HOME_URL,{waitUntil:'domcontentloaded'});}
 catch(error){await owned.browser.close();await owned.unlock();throw error;}
 const collectorPages:Page[]=[];let released=false;
 return {...owned,editorPage,collectorPages,release:async(options={keepEditorOpen:true})=>{
  if(released)return;released=true;
  try{for(const page of collectorPages)if(!page.isClosed())await page.close();if(!options.keepEditorOpen&&!editorPage.isClosed())await editorPage.close();}
  finally{try{await owned.browser.close();}finally{await owned.unlock();}}
 }};
}
export async function openCollectionSession(options:SessionOptions,deps:Dependencies=defaults):Promise<OwnedCollectionSession>{
 const owned=await connectOwned(options,deps),pages:Page[]=[];let released=false;
 return {...owned,pages,newPage:async()=>{if(released)throw Error('session_released');const page=await owned.context.newPage();pages.push(page);return page;},release:async()=>{
  if(released)return;released=true;
  try{for(const page of pages)if(!page.isClosed())await page.close();}finally{try{await owned.browser.close();}finally{await owned.unlock();}}
 }};
}
