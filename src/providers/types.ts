import type { FactDocument,EtfIdentity,Evidence,EtfOverview,Money,ExpenseDisclosure,Quote,Range52w,ExposureSet } from '../domain/etf.js';
export interface EtfProvider {
 resolve(symbol:string,market:string):Promise<EtfIdentity>;
 overview(id:EtfIdentity):Promise<Evidence<EtfOverview>>;
 aum(id:EtfIdentity):Promise<Evidence<Money>>;
 expenses(id:EtfIdentity):Promise<Evidence<ExpenseDisclosure[]>>;
 exchangeQuote(id:EtfIdentity):Promise<Evidence<Quote>>;
 priceRange52w(id:EtfIdentity):Promise<Evidence<Range52w>>;
 holdingsOrExposures(id:EtfIdentity):Promise<Evidence<ExposureSet>>;
 document:FactDocument;sourceFingerprint:string;
}
export interface ConceptImageProvider {generate(prompt:string):Promise<{bytes:Buffer;sourceUrl:string;model:string;licenseNote:string}>}
