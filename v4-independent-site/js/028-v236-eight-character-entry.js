
(function(){'use strict';
// Keep older preview files' sample state unmodified; this build uses its own storage key.
/* V2.69: dashboard is the default; explicit Characters links still work. */
// A small reset affordance makes repeated UI testing practical.
const initialShowcase=JSON.parse(document.getElementById('v236-eight-character-data').textContent);
function restore(){
 if(!window.confirm("Restore the eight test characters? This resets their levels, HP, resources, inventory and pending level-ups. Older offline versions are unaffected."))return;
 db.characters=JSON.parse(JSON.stringify(initialShowcase.characters));
 db.queue=JSON.parse(JSON.stringify(initialShowcase.queue));
 db.chat=JSON.parse(JSON.stringify(initialShowcase.chat));
 db.rooms={};db.featuredCharacters={frostvale:'showcase-01'};
 db.v229Featured={frostvale:['showcase-01','showcase-02','showcase-04']};
 db.v230MainFeatured={frostvale:'showcase-01'};db.campaign='frostvale';
 persist();navigate('/characters');toast('Eight showcase adventurers restored.');
}
const oldRender=renderCharacters;
renderCharacters=function(){
 const template=document.createElement('template');template.innerHTML=oldRender();
 const header=template.content.querySelector('.ledger-heading-links');
 if(header){const b=document.createElement('button');b.type='button';b.className='btn ghost';b.dataset.v236Reset='true';b.textContent='↺ Restore 8 demo characters';header.append(b);}
 const heading=template.content.querySelector('.ledger-heading p');
 if(heading)heading.textContent='Eight original, non-canon test characters across eight ancestries and eight classes. All rules and character-sheet systems are available for hands-on review.';
 return template.innerHTML;
};
document.addEventListener('click',event=>{if(!event.target.closest('[data-v236-reset]'))return;event.preventDefault();event.stopImmediatePropagation();restore();},true);
if(location.hash==='#/characters')renderPage(false);
})();
