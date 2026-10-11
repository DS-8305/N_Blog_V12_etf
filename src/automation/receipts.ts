export interface ImageReceipt {assetId:string;blockKey:string;index:number;confirmedAt:string}
import type { DraftReceipt } from '../domain/receipt.js';
export type { DraftReceipt } from '../domain/receipt.js';
export type DraftRunResult={status:'draft_saved';receipt:DraftReceipt}|{status:'needs_user'|'failed'|'draft_unconfirmed';code:string;message:string};
