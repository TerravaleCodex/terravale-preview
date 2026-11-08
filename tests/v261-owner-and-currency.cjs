/* Verify both character-sheet and ledger owner bylines using existing data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('site-overrides/v261-owner-byline.js','utf8');
let sheetByline=null,ledgerByline=null;
function element(tag){
 return {tag,className:'',children:[],textContent:'',
  append(...children){this.children.push(...children)}
 };
}
const titleFor=(kind)=>({
 after(node){if(kind==='sheet')sheetByline=node;else ledgerByline=node}
});
const sheetTitle=titleFor('sheet'),ledgerTitle=titleFor('ledger');
const card={
 dataset:{ledgerId:'char-1'},
 querySelector(selector){
  if(selector==='.tv261-player-byline')return null;
  return ledgerTitle;
 }
};
const fakeDocument={
 createElement(tag){
  if(tag!=='template')return element(tag);
  let html='';
  return {
   set innerHTML(value){html=value},
   get innerHTML(){return html},
   content:{
    querySelector(selector){
     return selector==='.sheet20-hero-copy > h2'&&html==='sheet'?sheetTitle:null;
    },
    querySelectorAll(selector){
     return selector.includes('.ledger-feature[data-ledger-id]')&&html==='ledger'?[card]:[];
    }
   }
  };
 }
};
const ctx={
 window:{TerravaleVerifiedAccount:{state:{profile:{discord_username:'test.discord'}}}},
 document:fakeDocument,
 db:{characters:[{id:'char-1',owner:'You',ownerName:'verified.user'}]},
 renderSheetV220(){return 'sheet'},
 renderCharacters(){return 'ledger'}
};
vm.createContext(ctx);
vm.runInContext(src,ctx);
assert.equal(ctx.renderSheetV220('char-1'),'sheet');
assert.equal(ctx.renderCharacters(),'ledger');
assert.ok(sheetByline&&ledgerByline,'Both bylines rendered');
function content(node){return node.children.map(c=>c.textContent).join('')}
assert.equal(content(sheetByline),'Played by verified.user');
assert.equal(content(ledgerByline),'Played by verified.user');
ctx.db.characters[0].ownerName='Adventurer';
ctx.db.characters[0].owner='You';
ctx.renderSheetV220('char-1');
assert.equal(content(sheetByline),'Played by test.discord','Mine uses verified profile fallback');
ctx.db.characters[0].ownerName='Aster';
ctx.db.characters[0].owner='Demo Party';
ctx.renderCharacters();
assert.equal(content(ledgerByline),'Played by Aster','Demo player credit remains visible');
console.log('PASS: sheet hero and featured ledger show verified owner names, preserving demo credits');
