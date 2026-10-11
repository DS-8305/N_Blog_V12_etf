import { join,resolve } from 'node:path';
import type { Page } from 'playwright';
import { captureRegion } from './captureRegion.js';
import type { FactDocument } from '../domain/etf.js';
import type { CapturedAsset } from '../domain/bundle.js';
import type { SourceHints } from '../providers/registry.js';
import { fingerprint } from '../editorial/fingerprint.js';
export async function captureOverview(job:string,page:Page,facts:FactDocument,config:NonNullable<SourceHints['capture']>):Promise<CapturedAsset>{
 const i=facts.identity,url=i.officialProductUrl;
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 if(!response?.ok()||new URL(page.url()).href!==new URL(url).href)throw Error('needs_user:official_product_redirect_or_block');
 const region=page.locator(config.regionSelector);if(await region.count()!==1)throw Error('needs_user:product_region_ambiguous');
 const meta=await captureRegion({page,locator:region,outputPath:resolve(job,'assets','etf_overview.png'),requiredLabels:[i.fundName,i.issuerName,i.symbol,facts.facts.overview.value.indexOrStrategy]});
 return {assetId:'etf_overview',role:'etf_overview',assetKind:'official_capture',relativePath:'assets/etf_overview.png',sourceUrl:url,asOf:facts.facts.overview.asOf,capturedAt:new Date().toISOString(),...meta,factIds:[facts.identityEvidence.factId,facts.facts.overview.factId],caption:'공식 ETF 상품 안내 · '+facts.facts.overview.asOf,licenseNote:config.licenseNote,reviewStatus:'verified',basisFingerprint:fingerprint(facts)};
}
