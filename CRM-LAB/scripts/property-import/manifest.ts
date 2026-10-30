import { z } from 'zod';
import { schemas } from '../../src/lib/validation';
import { importSourceUrl } from '../../src/lib/property-import';
const publicUrl=z.string().transform((value,ctx)=>{try{return importSourceUrl(value);}catch{ctx.addIssue({code:'custom',message:'Se requiere una URL HTTPS pública sin secretos ni parámetros.'});return z.NEVER;}});
const item=z.object({
  source:z.object({id:z.string().min(1).max(180),url:publicUrl,reference:z.string().max(180).default('')}).strict(),
  property:schemas.property,
  offers:z.array(schemas.offer.omit({propertyId:true}).refine(v=>Number(v.amount)>0,'Precio desconocido: revisar, no sustituir por cero.')).max(2),
  photos:z.array(publicUrl).max(30),
}).strict().superRefine((value,ctx)=>{
  if(new Set(value.photos).size!==value.photos.length)ctx.addIssue({code:'custom',message:'Fotos duplicadas.'});
  if(new Set(value.offers.map(x=>x.operation)).size!==value.offers.length)ctx.addIssue({code:'custom',message:'Operaciones duplicadas para un mismo inmueble.'});
  if(!value.offers.length&&!value.property.privateNotes.includes('Sin precio publicado'))ctx.addIssue({code:'custom',message:'Documentar Sin precio publicado cuando no se crea una oferta.'});
});
export const manifestSchema=z.object({schemaVersion:z.literal('1.0'),items:z.array(item).min(1).max(20000)}).strict().superRefine((value,ctx)=>{
  const keys=value.items.map(sourceKey);if(new Set(keys).size!==keys.length)ctx.addIssue({code:'custom',message:'IDs de origen duplicados.'});
});
export function sourceKey(item:{source:{url:string;id:string}}){return `${new URL(item.source.url).hostname}:${item.source.id}`;}
export function sourceMarker(item:{source:{url:string;id:string}}){return `Import source: ${JSON.stringify(sourceKey(item))}`;}
