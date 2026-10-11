import { it,expect } from 'vitest';import { chromium } from 'playwright';import { mkdtemp,rm } from 'node:fs/promises';import { tmpdir } from 'node:os';import { join } from 'node:path';import sharp from 'sharp';
import { captureOverview } from '../../src/capture/captureAsset.js';import { fundFixture } from '../fixtures/fund.js';
it('captures a real browser product region preserving its ratio; rejects company content',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),job=await mkdtemp(join(tmpdir(),'v12-capture-'));
 try{
  const page=await browser.newPage({viewport:{width:1400,height:900}}),f=fundFixture();let content='<div style="width:800px;height:360px;background:#eef5fa"><h1>Example Global Equity ETF</h1><p>Example Asset Management</p><p>EXAM · Example Global Index</p></div>';
  await page.route(f.identity.officialProductUrl,route=>route.fulfill({status:200,contentType:'text/html',body:content}));
  const a=await captureOverview(job,page,f,{regionSelector:'div',allowCapture:true,licenseNote:'Locally fulfilled fictional page'});
  expect([a.width,a.height]).toEqual([800,360]);expect(a.assetKind).toBe('official_capture');
  const m=await sharp(join(job,a.relativePath)).metadata();expect([m.width,m.height]).toEqual([800,360]);
  content='<div style="width:800px;height:360px">Example Asset Management company home</div>';
  await expect(captureOverview(job,page,f,{regionSelector:'div',allowCapture:true,licenseNote:'fixture'})).rejects.toThrow('required_label_missing');
 }finally{await browser.close();await rm(job,{recursive:true,force:true});}
},30000);
