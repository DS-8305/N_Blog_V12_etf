import { it,expect } from 'vitest';
import { chromium } from 'playwright';
import { dismissEditorHelp,focusNormalBody } from '../../src/automation/editorHelpers.js';
it('closes only the SmartEditor help panel and preserves existing content',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage();
  await page.setContent('<div class="se-components-wrap"><div class="se-title-text">Existing title</div><p>Existing text</p></div><article class="se-help-panel se-is-on"><button class="se-help-panel-close-button" onclick="this.parentElement.classList.remove(\'se-is-on\')">닫기</button></article>');
  await dismissEditorHelp(page);
  expect(await page.locator('.se-help-panel.se-is-on').count()).toBe(0);
  expect(await page.locator('.se-components-wrap').innerText()).toBe('Existing title\n\nExisting text');
 }finally{await browser.close();}
});
it('focuses the body after an image when the right sidebar covers the paragraph edge',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1000,height:700}});page.setDefaultTimeout(700);
  await page.setContent('<div class="se-components-wrap"><div class="se-component se-text"><div class="se-module-text"><p class="se-text-paragraph">Before image</p></div></div><div class="se-module-image">Image</div><div class="se-component se-text"><div class="se-module-text"><p class="se-text-paragraph" contenteditable="true" style="width:900px;height:50px"></p></div></div></div><aside class="se-sidebar-interaction" style="position:fixed;right:0;top:0;width:300px;height:700px;z-index:100">라이브러리<button class="se-sidebar-close-button" onclick="this.parentElement.style.display=\'none\'">팝업 닫기</button></aside>');
  await focusNormalBody(page,'last');await page.keyboard.insertText('Caption after image');
  expect(await page.locator('.se-text-paragraph').allTextContents()).toEqual(['Before image','Caption after image']);
  expect(await page.locator('aside').isVisible()).toBe(false);
 }finally{await browser.close();}
});
it('does not dismiss help or recovery when a draft recovery prompt is visible',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage();
  await page.setContent('<div class="se-popup-alert-confirm">작성 중인 글을 이어서 작성</div><article class="se-help-panel se-is-on"><button class="se-help-panel-close-button" onclick="this.parentElement.remove()">닫기</button></article>');
  await expect(dismissEditorHelp(page)).rejects.toThrow('needs_user:existing_draft');
  expect(await page.locator('.se-help-panel.se-is-on').count()).toBe(1);
  expect(await page.locator('.se-popup-alert-confirm').isVisible()).toBe(true);
 }finally{await browser.close();}
});
it('appends at the end of a nonempty wrapped source paragraph',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  const source='https://issuer.example/funds/'+('long-source-name-'.repeat(15))+'etf';
  await page.setContent('<div class="se-components-wrap"><div class="se-module-image">Image</div><div class="se-component se-text"><div class="se-module-text"><p class="se-text-paragraph" contenteditable="true" style="width:400px;word-break:break-all"></p></div></div></div>');
  await page.locator('.se-text-paragraph').fill(source);
  await focusNormalBody(page,'last');await page.keyboard.insertText(' appended');
  expect(await page.locator('.se-text-paragraph').innerText()).toBe(source+' appended');
 }finally{await browser.close();}
});
it('adds a body after a generated link card without inserting into the preceding URL',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage();
  await page.setContent('<div class="se-components-wrap"><div class="se-component se-text"><div class="se-module-text"><p class="se-text-paragraph" contenteditable="true">Source URL</p></div></div><div class="se-component se-oglink">Link card</div></div><button onclick="document.querySelector(\'.se-components-wrap\').insertAdjacentHTML(\'beforeend\',\'<div class=&quot;se-component se-text&quot;><div class=&quot;se-module-text&quot;><p class=&quot;se-text-paragraph&quot; contenteditable=&quot;true&quot;><br></p></div></div>\')">본문 추가</button>');
  await focusNormalBody(page,'last');await page.keyboard.insertText('Next source');
  expect(await page.locator('.se-text-paragraph').allTextContents()).toEqual(['Source URL','Next source']);
 }finally{await browser.close();}
});
