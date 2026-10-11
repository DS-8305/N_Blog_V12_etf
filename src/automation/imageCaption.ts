import type { Page } from 'playwright';
import { getEditorFrame } from './editorHelpers.js';
import { selectors } from './selectors.js';
export async function setImageCaption(page:Page,text:string):Promise<void>{
 const frame=await getEditorFrame(page),image=frame.locator(selectors.images).last(),component=image.locator('xpath=ancestor::div[contains(@class,"se-component")][1]');
 await image.scrollIntoViewIfNeeded();await image.click();
 const caption=component.locator('.se-caption .se-text-paragraph');
 if(await caption.count()!==1||!await caption.isVisible())throw Error('needs_user:native_caption_unsupported');
 if((await caption.locator('.__se-node').allTextContents()).join('').trim())throw Error('native_caption_not_blank');
 await caption.click();await page.keyboard.insertText(text);
 if((await caption.locator('.__se-node').allTextContents()).join('')!==text)throw Error('native_caption_unconfirmed');
}
