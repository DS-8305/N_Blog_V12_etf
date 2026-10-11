import { z } from 'zod';
export const nonempty=z.string().trim().min(1);
export const id=nonempty.regex(/^[a-zA-Z0-9_-]+$/);
export const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;},'invalid_date');
export const instant=z.string().datetime({offset:true});
export const url=z.string().url().refine(v=>{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;},'https_source_required');
export const finite=z.number().finite();
export function record(v:unknown,label='record'):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid_'+label);return v as Record<string,unknown>;}
export function string(v:unknown,label='string'):string{return nonempty.parse(v);}
export function integer(v:unknown,label='integer',min=0):number{return z.number().int().min(min).parse(v);}
export function array(v:unknown,label='array'):unknown[]{return z.array(z.unknown()).parse(v);}
export function safeId(v:unknown):string{return id.parse(v);}
export function timestamp(v:unknown):string{return instant.parse(v);}
export interface ValidationIssue {code:string;path:string;message:string}
export interface ValidationReport {errors:ValidationIssue[];warnings:ValidationIssue[];fingerprint:string}
