import { z } from 'zod';
import { id,date,nonempty } from './validation.js';
import { markets } from './etf.js';
import { parseDraftReceipt } from './receipt.js';
export const requestSchema=z.object({schemaVersion:z.literal(1),jobId:id,symbol:nonempty,market:z.enum(markets),asOfDate:date,issuer:nonempty.optional(),isin:nonempty.optional(),conditions:z.object({includeImageCaptions:z.literal(true).default(true),imageCaptionPlacement:z.literal('body').default('body'),articleLength:z.object({min:z.number().int().positive(),max:z.number().int().positive()}).default({min:800,max:1000})}).default({})}).strict();
export type JobRequest=z.infer<typeof requestSchema>;
export function parseJobRequest(v:unknown):JobRequest{const r=requestSchema.parse(v);if(r.conditions.articleLength.max<r.conditions.articleLength.min)throw Error('invalid_article_length');if(r.market.startsWith('KRX:')&&!/^\d{6}$/.test(r.symbol))throw Error('invalid_krx_symbol');return r;}
export const phases=['selected','resolving','collecting','collected','writing','validated','inserting','draft_saved','needs_user','failed','draft_unconfirmed'] as const;
export type JobPhase=typeof phases[number];
export interface JobState {schemaVersion:1;jobId:string;phase:JobPhase;lastAcknowledgedEvent:number;saveAttempt:{status:'not_attempted'|'attempted_unconfirmed'|'confirmed';startedAt?:string;receipt?:unknown;fingerprint?:string};error:{code:string;message:string;resumePhase:JobPhase}|null}
export function parseJobState(v:unknown):JobState{
 const s=z.object({schemaVersion:z.literal(1),jobId:id,phase:z.enum(phases),lastAcknowledgedEvent:z.number().int().min(-1),saveAttempt:z.object({status:z.enum(['not_attempted','attempted_unconfirmed','confirmed']),startedAt:z.string().optional(),receipt:z.unknown().optional(),fingerprint:z.string().optional()}),error:z.object({code:nonempty,message:nonempty,resumePhase:z.enum(phases)}).nullable()}).strict().parse(v);
 if(s.phase==='draft_saved'&&s.saveAttempt.status!=='confirmed')throw Error('confirmed_receipt_required');
 if(s.saveAttempt.status==='confirmed'){const r=parseDraftReceipt(s.saveAttempt.receipt);if(r.jobId!==s.jobId||r.fingerprint!==s.saveAttempt.fingerprint)throw Error('receipt_binding_mismatch');}
 return s;
}
