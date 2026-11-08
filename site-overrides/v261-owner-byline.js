/* V2.61: show real account owner on character-sheet and ledger cards.
   This only reads existing verified character data. No account or grant writes. */
(function(){
 'use strict';
 if(typeof renderSheetV220!=='function'||typeof renderCharacters!=='function')return;
 const ownerFor=character=>{
  if(!character)return '';
  const current=window.TerravaleVerifiedAccount?.state?.profile?.discord_username||'';
  const known=String(character.ownerName||character.demoCurator||'').trim();
  if(known&&known!=='Adventurer')return known;
  if(character.owner==='You'&&current)return current;
  return '';
 };
 const byline=owner=>{
  const line=document.createElement('p');
  line.className='tv261-player-byline';
  const prefix=document.createElement('span');
  prefix.textContent='Played by ';
  const name=document.createElement('strong');
  name.textContent=owner;
  line.append(prefix,name);
  return line;
 };
 const priorSheet=renderSheetV220;
 renderSheetV220=function(id){
  const result=priorSheet.apply(this,arguments);
  const character=(db.characters||[]).find(c=>String(c.id)===String(id));
  const owner=ownerFor(character);
  if(!owner)return result;
  const template=document.createElement('template');
  template.innerHTML=result;
  const title=template.content.querySelector('.sheet20-hero-copy > h2');
  if(title&&!template.content.querySelector('.sheet20-hero-copy > .tv261-player-byline'))
   title.after(byline(owner));
  return template.innerHTML;
 };
 const priorLedger=renderCharacters;
 renderCharacters=function(){
  const result=priorLedger.apply(this,arguments);
  const template=document.createElement('template');
  template.innerHTML=result;
  const cards=template.content.querySelectorAll(
   '.ledger-feature[data-ledger-id],.v229-featured-card[data-ledger-id],.ledger-card[data-ledger-id]');
  for(const card of cards){
   const character=(db.characters||[]).find(c=>String(c.id)===String(card.dataset.ledgerId));
   const owner=ownerFor(character);
   if(!owner||card.querySelector('.tv261-player-byline'))continue;
   const title=card.querySelector('.ledger-feature-copy h2,.ledger-feature-copy h3,.ledger-card-copy h3,h2,h3');
   if(title)title.after(byline(owner));
  }
  return template.innerHTML;
 };
})();
