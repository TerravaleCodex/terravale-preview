const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('site-overrides/sheet-live-v091.html','utf8');
function slice(start,end){
 const from=html.indexOf(start),to=html.indexOf(end,from);
 assert(from>=0&&to>from,'Missing function '+start);
 return html.slice(from,to);
}
const code=[
 slice('function validLivePortrait(url){','function openPortraitViewer('),
 slice('function renderLivePortrait(){','function renderHeader(){'),
 slice('function applyLivePortraitUpdate(portraitUrl){','function loadApprovedCharacter(payload){')
].join('\n');
const valid=n=>'https://emwlvbmnrrhxhrmlwkhs.supabase.co/storage/v1/object/sign/terravale-character-portraits/test/photo.png?token='+n;
function element(tag,klass=''){
 const x={tag,attributes:{},dataset:{},children:[],events:{},hidden:false,
  textContent:'',title:'',className:klass,
  classList:{values:new Set,add(k){this.values.add(k)},remove(k){this.values.delete(k)},contains(k){return this.values.has(k)}},
  setAttribute(key,val){this.attributes[key]=val},
  addEventListener(key,fn){this.events[key]=fn},
  append(...children){for(const el of children){this.children.push(el);el.parent=this}},
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this)}
 };
 return x;
}
const slot=element('div','portrait'),glyph=element('span','portrait-glyph'),label=element('small');
slot.append(glyph,label);
slot.querySelector=sel=>sel==='.portrait-glyph'?glyph:sel==='small'?label:slot.children.find(x=>x.className===sel.slice(1))||null;
const sent=[];
const context={LIVE:{enabled:true,loaded:true,charId:'character',portraitUrl:'',readOnly:false},
 document:{querySelector:sel=>sel==='.hero .portrait'?slot:null,createElement:tag=>element(tag)},
 window:{parent:{postMessage:x=>sent.push(x)}},
 location:{origin:'https://example.test'},
 p:()=>({name:'Example hero'}),
 openPortraitViewer:()=>{},
 URL,console
};
vm.createContext(context);vm.runInContext(code,context);
assert.equal(context.applyLivePortraitUpdate(valid('initial')),true);
let trigger=slot.querySelector('.live-portrait-trigger');
assert(trigger,'Newly signed portrait must appear even after the initial sheet load');
assert.equal(trigger.children[0].src,valid('initial'));
assert.equal(context.applyLivePortraitUpdate(valid('initial')),false);
assert.strictEqual(slot.querySelector('.live-portrait-trigger'),trigger,'Same signed link should not replace a working image');
context.applyLivePortraitUpdate(valid('renewed'));
trigger=slot.querySelector('.live-portrait-trigger');
assert.equal(trigger.children[0].src,valid('renewed'),'Renewed signed URLs must replace the image');
trigger.children[0].events.error();
assert(!slot.querySelector('.live-portrait-trigger'),'Broken image removed');
assert(slot.querySelector('.live-portrait-error'),'Retry action shown');
assert.equal(slot.dataset.livePortraitUrl,'','Failed URL must not remain marked as displayed');
assert.equal(glyph.hidden,false,'Fallback symbol must be visible after failure');
slot.querySelector('.live-portrait-error').events.click();
assert.equal(sent[0].type,'TV_SHEET_PORTRAIT_RETRY');
context.applyLivePortraitUpdate(valid('retry'));
assert.equal(slot.querySelector('.live-portrait-trigger').children[0].src,valid('retry'),'New link must restore portrait');
assert(html.includes("applyLivePortraitUpdate(payload.portraitUrl);"),'Same-build shortcut must apply image updates');
assert(!html.includes("LIVE.portraitUrl=typeof payload.portraitUrl==='string'?payload.portraitUrl:LIVE.portraitUrl;"),'No silent, non-rendering shortcut');
console.log('PASS: async signed image, refresh after HP save, expiry renewal, error fallback and retry');
