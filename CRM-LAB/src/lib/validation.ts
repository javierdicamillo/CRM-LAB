import { z } from 'zod';
const short=z.string().trim().max(180), note=z.string().max(10000).default('');
const optionalId=z.union([z.uuid(),z.literal('')]).default('');
const assignee=z.string().max(100).default('');
const email=z.union([z.email(),z.literal('')]).default('');
export const schemas = {
  contact:z.object({name:short.min(1),email,phone:z.string().max(40).default(''),type:z.enum(['buyer','owner','tenant','other']),notes:note,assigneeId:assignee}).strict(),
  property:z.object({title:short.min(1),type:z.enum(['apartment','house','land','office','store','warehouse','other']),status:z.enum(['available','reserved','sold','rented','archived']),country:z.string().regex(/^[A-Z]{2}$/).default('AR'),region:short.min(1),city:short.min(1),neighborhood:short.default(''),privateAddress:short.default(''),publicAddress:short.default(''),description:note,privateNotes:note,area:z.coerce.number().min(0).max(100000000),bedrooms:z.coerce.number().int().min(0).max(1000),bathrooms:z.coerce.number().int().min(0).max(1000),ownerId:optionalId,assigneeId:assignee}).strict(),
  offer:z.object({propertyId:z.uuid(),operation:z.enum(['sale','rent']),amount:z.string().regex(/^(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?$/),currency:z.enum(['USD','ARS','EUR']),period:z.enum(['total','month','day']),notes:note}).strict(),
  opportunity:z.object({title:short.min(1),contactId:z.uuid(),offerId:optionalId,stage:z.enum(['new','contacted','visit','negotiation','won','lost']),amount:z.string().regex(/^(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?$/).default('0'),currency:z.enum(['USD','ARS','EUR']),assigneeId:assignee,notes:note}).strict(),
  activity:z.object({title:short.min(1),type:z.enum(['task','call','visit','meeting']),dueAt:z.iso.datetime({offset:true}),done:z.boolean().default(false),contactId:optionalId,propertyId:optionalId,opportunityId:optionalId,assigneeId:assignee,notes:note}).strict()
};
export type Kind=keyof typeof schemas;
export const kinds=Object.keys(schemas) as Kind[];
export const inquirySchema=z.object({inquiry_id:z.uuid(),source_listing_id:z.uuid(),created_at:z.iso.datetime({offset:true}),contact:z.object({name:z.string().min(1).max(150),email:z.email().optional(),phone:z.string().min(1).max(40).optional()}).refine(c=>!!(c.email||c.phone)),message:z.string().max(5000),source:z.literal('PORTAL-LAB'),delivery_status:z.enum(['pending','delivered'])});
export const userSchema=z.object({name:short.min(1),email:z.email(),password:z.string().min(12).max(128),role:z.enum(['admin','agent'])}).strict();
export const agencySchema=z.object({agencyName:short.min(1),city:short.default(''),phone:z.string().max(40).default(''),email}).strict();
