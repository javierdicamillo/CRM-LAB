import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { schemas,inquirySchema } from '../src/lib/validation';
process.env.BETTER_AUTH_SECRET='test-only-secret-never-used-for-production-123456789';
process.env.BETTER_AUTH_URL='http://localhost:3000';
const { publicListing }=await import('../src/lib/business');
const { retryDelay }=await import('../src/lib/sync');
const { validToken }=await import('../src/lib/errors');
const contract=JSON.parse(readFileSync(new URL('../../contracts/openapi.json',import.meta.url),'utf8'));
const ajv=new Ajv({strict:false});addFormats(ajv);
const validate=ajv.compile({$ref:'#/components/schemas/PublishedUpdate',components:contract.components});
test('publicación cumple el contrato y excluye datos privados',()=>{
 const property={id:'11111111-1111-4111-8111-111111111111',data:{title:'Casa',type:'house',description:'Texto público',country:'AR',region:'Neuquén',city:'Neuquén',neighborhood:'Centro',area:90,bedrooms:2,bathrooms:1,privateAddress:'NO PUBLICAR',privateNotes:'SECRETO',ownerId:'privado'}};
 const offer={data:{operation:'sale',amount:'120000.00',currency:'USD',period:'total',notes:'COMISION PRIVADA'}};
 const dto={status:'published',revision:1,listing:{...publicListing(property,offer),media_ids:['22222222-2222-4222-8222-222222222222']}};
 assert.equal(validate(dto),true,JSON.stringify(validate.errors));
 assert.ok(!JSON.stringify(dto).includes('PRIVAD'));assert.ok(!JSON.stringify(dto).includes('NO PUBLICAR'));assert.ok(!JSON.stringify(dto).includes('ownerId'));
});
test('entradas rechazan campos de permisos y precios inválidos',()=>{
 assert.equal(schemas.contact.safeParse({name:'A',type:'buyer',role:'admin'}).success,false);
 assert.equal(schemas.offer.safeParse({propertyId:'11111111-1111-4111-8111-111111111111',operation:'sale',amount:'-1',currency:'USD',period:'total'}).success,false);
 assert.equal(inquirySchema.safeParse({inquiry_id:'../etc/passwd'}).success,false);
});
test('token privado no acepta vacío y compara valores completos',()=>{
 assert.equal(validToken('',''),false);assert.equal(validToken('abc','abcd'),false);assert.equal(validToken('abc','abc'),true);
});
test('reintentos crecen y nunca superan quince minutos',()=>{
 assert.ok(retryDelay(3,.5)>retryDelay(1,.5));assert.ok(retryDelay(100,1)<=900);
});
