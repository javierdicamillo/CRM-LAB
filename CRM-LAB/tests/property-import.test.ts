import test from 'node:test';
import assert from 'node:assert/strict';
import {propertyImportInstructions,importSourceUrl} from '../src/lib/property-import';
import {manifestSchema,sourceMarker} from '../scripts/property-import/manifest';
const property={title:'Casa de ejemplo',type:'house',status:'available',region:'Provincia de ejemplo',city:'Ciudad de ejemplo',area:50,bedrooms:2,bathrooms:1};
const item={source:{id:'example-1',url:'https://inmobiliaria.example/p/1'},property,offers:[{operation:'sale',amount:'100000',currency:'USD',period:'total'}],photos:['https://media.example/1.jpg']};
test('instructions distinguish website and API without enabling execution',()=>{
 for(const type of ['website','api'] as const){const json=propertyImportInstructions(type,'https://inmobiliaria.example/','https://crm.example');assert.equal(json.source.type,type);assert.equal(json.execution.automaticImportEnabled,false);assert.equal(json.target.publication,'draft');assert.equal(json.target.approvePhotos,false);assert.ok(json.instructions.length>5);assert.doesNotThrow(()=>JSON.parse(JSON.stringify(json)));}
 assert.ok(JSON.stringify(propertyImportInstructions('api','https://api.example/properties','https://crm.example')).includes('SOURCE_API_TOKEN'));
});
test('URLs reject embedded credentials, query secrets, fragments and local addresses',()=>{
 for(const u of ['http://site.example','https://user:password@site.example','https://api.example?token=secret','https://site.example/#key','https://localhost','https://host.local','https://127.0.0.1','https://[::1]','https://site.example:8443'])assert.throws(()=>importSourceUrl(u));
 assert.equal(importSourceUrl(' https://site.example/listings '),'https://site.example/listings');
});
test('manifest rejects duplicate source IDs, operations, photos and silent excess',()=>{
 assert.equal(manifestSchema.parse({schemaVersion:'1.0',items:[item]}).items.length,1);
 assert.throws(()=>manifestSchema.parse({schemaVersion:'1.0',items:[item,item]}));
 for(const change of [{offers:[...item.offers,...item.offers]},{photos:[...item.photos,...item.photos]},{photos:Array.from({length:31},(_,i)=>`https://media.example/${i}.jpg`)}])assert.throws(()=>manifestSchema.parse({schemaVersion:'1.0',items:[{...item,...change}]}));
});
test('unknown price is documented, never silently zero',()=>{
 assert.throws(()=>manifestSchema.parse({schemaVersion:'1.0',items:[{...item,offers:[{...item.offers[0],amount:'0'}]}]}));
 assert.throws(()=>manifestSchema.parse({schemaVersion:'1.0',items:[{...item,offers:[]}]}));
 assert.doesNotThrow(()=>manifestSchema.parse({schemaVersion:'1.0',items:[{...item,offers:[],property:{...property,privateNotes:'Sin precio publicado: consultar.'}}]}));
 assert.equal(sourceMarker(item),'Import source: "inmobiliaria.example:example-1"');
});
