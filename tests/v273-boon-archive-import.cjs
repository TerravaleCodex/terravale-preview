/* V2.73 — validate safe browser import without accessing private archives on CI. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('site-overrides/v273-boon-archive-import.js','utf8');
const frame={window:{},TextDecoder,Blob,Response,DecompressionStream,console};
vm.runInNewContext(source,frame,{timeout:1500,filename:'v273-boon-archive-import.js'});
const importer=frame.window.TerravaleBoonArchiveV273;
assert.equal(typeof importer?.unzipMarkdown,'function');
assert.equal(typeof importer?.derive,'function');
const patrons=[{id:'p-1',name:'Pae',key_name:'pae',rank:'greater'}];
const markdown=[
'---',
'title: Lantern of Justice',
'kind: divine',
'patron: Pae',
'required_favour: 5',
'max_charges: 2',
'recovery: long',
'---',
'# Lantern of Justice',
'This boon retains its exact **canon wording**.',
'',
'Two charges return only after the prescribed long rest.'
].join('\n');
const result=importer.derive({name:'Boons/Pae/Lantern of Justice.md',text:markdown},patrons);
assert.equal(result.name,'Lantern of Justice');
assert.equal(result.kind,'divine');
assert.equal(result.patron,'Pae');
assert.equal(result.required_favour,'5');
assert.equal(result.max_charges,'2');
assert.equal(result.recovery,'long');
assert.equal(result.mechanics,markdown);
assert.equal(result.state,'draft');
const unknown=importer.derive({name:'Boons/Unknown Gift.md',text:'# Unknown Gift\nThe gods have not yet spoken.'},patrons);
assert.equal(unknown.required_favour,'','Never fabricate a favour threshold');
assert.equal(unknown.kind,'','Never fabricate a boon family');
assert.equal(unknown.patron,'','Never fabricate a patron');
assert.equal(unknown.state,'draft');
assert.ok(!source.includes('localStorage'),'Private source content may not be cached in browser storage');
assert.ok(!source.includes('innerHTML'),'Untrusted Markdown may not be interpolated as HTML');
assert.ok(source.includes('Import verified private drafts'),'Import must require explicit review');
function storeZip(name,text){
 const nameBytes=Buffer.from(name),body=Buffer.from(text,'utf8');
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);
 local.writeUInt16LE(20,4);local.writeUInt32LE(body.length,18);local.writeUInt32LE(body.length,22);
 local.writeUInt16LE(nameBytes.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);
 central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
 central.writeUInt32LE(body.length,20);central.writeUInt32LE(body.length,24);
 central.writeUInt16LE(nameBytes.length,28);central.writeUInt32LE(0,42);
 const dirOffset=local.length+nameBytes.length+body.length;
 const dirSize=central.length+nameBytes.length;
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
 end.writeUInt32LE(dirSize,12);end.writeUInt32LE(dirOffset,16);
 return new Blob([local,nameBytes,body,central,nameBytes,end]);
}
(async()=>{
 const archive=storeZip('Boons/Pae/Lantern.md',markdown);
 const extracted=await importer.unzipMarkdown(archive);
 assert.equal(extracted.length,1);
 assert.equal(extracted[0].name,'Boons/Pae/Lantern.md');
 assert.equal(extracted[0].text,markdown);
 const parsed=importer.derive(extracted[0],patrons);
 assert.equal(parsed.mechanics,markdown);
 console.log('PASS V2.73: ZIP extraction, canonical Markdown preservation, secure draft import, no guessed metadata.');
})().catch(e=>{console.error(e);process.exitCode=1});
