import { z } from 'zod';
import { id,url,date,instant,nonempty,type ValidationReport } from './validation.js';
export const requiredRoles=['etf_overview','aum_fee_card','etf_price_52w_card','holdings_sectors_card','etf_outlook_visual'] as const;
export type AssetRole=typeof requiredRoles[number];
export function requiredImageRoles(layout:'etf_five'='etf_five'):readonly AssetRole[]{return requiredRoles;}
export const assetSchema=z.object({
 assetId:id,role:z.enum(requiredRoles),assetKind:z.enum(['official_capture','data_card','ai_concept']),relativePath:nonempty,sourceUrl:url,asOf:date,capturedAt:instant,generatedAt:instant.optional(),sha256:z.string().regex(/^[a-f0-9]{64}$/),width:z.number().int().positive(),height:z.number().int().positive(),factIds:z.array(id).min(1),caption:nonempty,licenseNote:nonempty,reviewStatus:z.literal('verified'),basisFingerprint:z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
export type CapturedAsset=z.infer<typeof assetSchema>;
export const manifestSchema=z.object({schemaVersion:z.literal(1),jobId:id,assets:z.array(assetSchema)}).strict();
export type AssetManifest=z.infer<typeof manifestSchema>;
export const sectionSchema=z.object({heading:nonempty,role:z.enum(requiredRoles),text:nonempty,factIds:z.array(id).min(1),claims:z.array(z.object({text:nonempty,factId:id})).default([])}).strict();
export const postSchema=z.object({schemaVersion:z.literal(1),jobId:id,titleCandidates:z.array(nonempty).length(7),selectedTitle:nonempty,titleFactIds:z.array(id).min(1),sections:z.array(sectionSchema).length(5),tags:z.array(nonempty),basisFingerprint:nonempty}).strict();
export type PostDocument=z.infer<typeof postSchema>;
export type EditorEvent={type:'setTitle'|'typeText'|'typeBold'|'insertQuote';text:string;bold?:boolean}|{type:'setImageCaption';text:string;assetId:string}|{type:'insertImage';relativePath:string;absolutePath:string;assetId:string};
export interface PreparedDraft {jobId:string;jobPath:string;title:string;fingerprint:string;events:EditorEvent[];assets:CapturedAsset[];expected:{bodyText:string;imageAssetIds:string[];captions:string[];sources:string[]}}
export type { ValidationReport };
