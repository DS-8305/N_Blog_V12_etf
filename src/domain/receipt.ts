import { array,record,safeId,string,timestamp } from './validation.js';
export interface DraftReceipt {jobId:string;fingerprint:string;title:string;bodyText:string;confirmedAt:string;imageAssetIds:string[];captions:string[];sources:string[];identity:{siteId?:string;listText:string;savedAt?:string;reopenedUrl?:string}}
export function parseDraftReceipt(value:unknown):DraftReceipt {
 const doc=record(value),identity=record(doc.identity);
 const fingerprint=string(doc.fingerprint,'receipt_fingerprint');if(!/^[a-f0-9]{64}$/.test(fingerprint))throw Error('invalid_receipt_fingerprint');
 const imageAssetIds=array(doc.imageAssetIds,"image_asset_ids").map(safeId),captions=array(doc.captions,"captions").map(x=>string(x,'caption')),sources=array(doc.sources,"sources").map(x=>string(x,'source'));
 if(!imageAssetIds.length||(captions.length!==0&&imageAssetIds.length!==captions.length)||new Set(imageAssetIds).size!==imageAssetIds.length||!sources.length)throw Error('invalid_receipt_content');
 const listText=string(identity.listText,'list_text');if(!identity.siteId&&!identity.reopenedUrl)throw Error('receipt_identity_required');
 return {jobId:safeId(doc.jobId),fingerprint,title:string(doc.title,'receipt_title'),bodyText:string(doc.bodyText,'receipt_body'),confirmedAt:timestamp(doc.confirmedAt),imageAssetIds,captions,sources,identity:{listText,...(identity.siteId?{siteId:string(identity.siteId,'site_id')}:{}),...(identity.reopenedUrl?{reopenedUrl:string(identity.reopenedUrl,'reopened_url')}:{}),...(identity.savedAt?{savedAt:timestamp(identity.savedAt)}:{})}};
}
