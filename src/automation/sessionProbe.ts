import type { Page } from 'playwright';import type { OwnedSession } from '../browser/session.js';
export interface SessionEvidence {url:string;hasRequiredCookies:boolean;authenticatedUiVisible:boolean;loginFormVisible:boolean;securityRequirementVisible:boolean}
export function classifySessionEvidence(e:SessionEvidence):'authenticated'|'missing'|'security'{if(e.securityRequirementVisible)return 'security';if(e.loginFormVisible||e.url.includes('nid.naver.com'))return 'missing';return e.hasRequiredCookies||e.authenticatedUiVisible?'authenticated':'missing';}
export async function probePageSession(page:Page):Promise<'authenticated'|'missing'|'security'>{if(page.isClosed())throw new Error('owned_tab_closed');const cookies=await page.context().cookies(['https://www.naver.com/','https://blog.naver.com/']);let loginFormVisible=false,authenticatedUiVisible=false,securityRequirementVisible=false;
 for(const frame of page.frames()){loginFormVisible ||=await frame.locator("input#id, input#pw").first().isVisible();authenticatedUiVisible ||=await frame.getByRole('link',{name:'로그아웃',exact:true}).first().isVisible();securityRequirementVisible ||=await frame.locator("#captchaimg, input[name='captcha'], iframe[src*='captcha']").first().isVisible();}
 return classifySessionEvidence({url:page.url(),hasRequiredCookies:['NID_AUT','NID_SES'].every(name=>cookies.some(c=>c.name===name&&c.value)),loginFormVisible,authenticatedUiVisible,securityRequirementVisible});
}
export async function verifyOwnedSession(session:OwnedSession){return probePageSession(session.editorPage);}
