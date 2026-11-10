/* V2.82 — private, DM-toggled directional Favour relationships. */
(function(){
'use strict';
const api=()=>window.TerravaleVerifiedAccount?.supabase;
const isDM=()=>!!window.TerravaleVerifiedAccount?.state?.ready&&
 !!window.TerravaleVerifiedAccount?.state?.profile?.is_dm&&
 typeof db!=='undefined'&&db.role==='dm';
const elem=(tag,cls,txt)=>{const e=document.createElement(tag);
 if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e};
const button=(label,fn)=>{const b=elem('button','btn ghost small',label);
 b.type='button';b.addEventListener('click',fn);return b};
const view={campaign:null,host:null,enabled:true,apply:true,links:[],busy:false,
 detailsOpen:false};
const label=k=>k?String(k)[0].toUpperCase()+String(k).slice(1):'Unknown';
async function rpc(name,args){
 const {data,error}=await api().rpc(name,args);
 if(error)throw Error(error.message||String(error));
 return data;
}
function row(head,value){
 const wrap=elem('div','tv282-rel-row');
 wrap.append(head,value);return wrap;
}
function impactSummary(changes){
 const host=document.querySelector('[data-tv282-favour-impact]');
 if(!host)return;
 host.replaceChildren();
 if(!changes?.length){
  host.append(elem('small','tv282-rel-info',
    'Only the selected god’s direct Favour changed. No linked standing was changed.'));
  return;
 }
 host.append(elem('strong','','Related divine judgements'));
 for(const item of changes){
  const sign=Number(item.change)>0?'+':'';
  const note=elem('div','',label(item.target)+' '+sign+item.change+
   ' ('+(item.prior>=0?'+':'')+item.prior+' → '+(item.score>=0?'+':'')+item.score+')');
  note.title=item.note||'';
  host.append(note);
 }
}
async function save(args){
 if(view.busy||!view.campaign||!isDM())return;
 view.busy=true;
 const status=view.host?.querySelector('[data-tv282-relation-status]');
 if(status)status.textContent='Saving divine relationships…';
 try{
  const state=await rpc('terravale_divine_dm_relationship_config',
    {target_campaign:view.campaign,...args});
  if(view.campaign!==view.host?.dataset.tv282RelationCampaign)return;
  view.enabled=state.enabled!==false;
  view.links=state.links||[];
  render();
 }catch(e){if(status)status.textContent='Relationship update failed: '+e.message}
 finally{view.busy=false}
}
async function load(){
 if(!view.campaign||!isDM())return;
 const target=view.campaign;
 try{
  const state=await rpc('terravale_divine_dm_relationship_state',{target_campaign:target});
  if(view.campaign!==target||!view.host?.isConnected)return;
  view.links=state.links||[];view.enabled=state.enabled!==false;
  render();
 }catch(e){
  if(view.host?.isConnected)view.host.textContent='Could not read divine relationship settings: '+e.message;
 }
}
function render(){
 const host=view.host;if(!host?.isConnected)return;
 host.replaceChildren();host.dataset.tv282RelationCampaign=view.campaign;
 const header=elem('div','tv282-rel-head');
 header.append(elem('h4','','Divine relationships'));
 const setting=elem('label','tv282-rel-switch');
 const checked=elem('input');checked.type='checkbox';checked.checked=view.enabled;
 checked.addEventListener('change',()=>save({enable_all:checked.checked}));
 setting.append(checked,elem('strong','',view.enabled?'Connected · ON':'Independent · OFF'));header.append(setting);
 host.append(header);
 host.append(elem('p','tv282-rel-info',
 'Default-on, adjustable interpretations of divine sympathy and tension. Only gains in direct Favour accumulate toward a linked change; reactions never cascade. The Greater Three cannot gain indirect Favour above +2. These connections do not award boons.'));
 const local=elem('label','tv282-rel-switch');
 const localCheck=elem('input');localCheck.type='checkbox';localCheck.checked=view.apply;
 localCheck.addEventListener('change',()=>{view.apply=localCheck.checked});
 local.append(localCheck,elem('span','','Apply related effects to my next Favour adjustment'));
 host.append(local);
 const count=elem('p','tv282-rel-info',
  view.links.filter(x=>x.enabled).length+' active connections · '+view.links.length+' editable suggested connections');
 host.append(count);
 const summary=elem('div','tv282-impacts');summary.dataset.tv282FavourImpact='1';host.append(summary);
 const details=elem('details','tv282-rel-details');details.open=view.detailsOpen;
 details.addEventListener('toggle',()=>view.detailsOpen=details.open);
 details.append(elem('summary','','Review and customise deity connections'));
 const list=elem('div','');
 for(const link of view.links){
  const item=elem('div','tv282-rel-row');
  const left=elem('div','');
  left.append(elem('strong','',label(link.source)+' → '+label(link.target)),
   elem('small','',link.note||'DM-created relationship'));
  const right=elem('div','tv281-actions');
  const toggle=elem('label','tv282-rel-switch');
  const box=elem('input');box.type='checkbox';box.checked=link.enabled;
  box.addEventListener('change',()=>save({source_key:link.source,
   target_key:link.target,link_enabled:box.checked}));
  toggle.append(box,elem('span','',link.enabled?'Active':'Off'));
  right.append(toggle);
  const impact=button((link.impact>0?'+':'')+link.impact+' Favour',()=>save({
   source_key:link.source,target_key:link.target,
   link_impact:link.impact>0?-1:1}));
  impact.title='Toggle this directional connection between sympathy and tension';
  right.append(impact);
  const cadence=button('Every +'+link.every,()=>save({
   source_key:link.source,target_key:link.target,
   link_every:link.every>=5?1:link.every+1}));
  cadence.title='How many positive direct Favour points trigger one reaction';
  right.append(cadence);
  item.append(left,right);list.append(item);
 }
 details.append(list);
 const add=elem('details','tv282-rel-details');
 add.append(elem('summary','','Add another directional connection'));
 const form=elem('div','tv282-rel-row');
 const fields=elem('div','tv282-rel-add-fields');
 const a=elem('input','tv281-search');a.placeholder='From god (e.g. Kalma)';
 const b=elem('input','tv281-search');b.placeholder='To god (e.g. Eshael)';
 a.setAttribute('aria-label','Source god');b.setAttribute('aria-label','Affected god');
 fields.append(a,b);form.append(fields);
 form.append(button('Add relationship',()=>{
  const source=a.value.trim().toLowerCase(),target=b.value.trim().toLowerCase();
  if(!source||!target||source===target)return;
  save({source_key:source,target_key:target,link_enabled:true,
    link_impact:-1,link_every:3});
 }));add.append(form);details.append(add);
 host.append(details);
 const status=elem('div','tv281-small');status.dataset.tv282RelationStatus='1';host.append(status);
}
function mount(host,campaign){
 if(!isDM()||!host||!campaign)return;
 if(view.host===host&&view.campaign===campaign)return;
 view.host=host;view.campaign=campaign;view.apply=true;view.enabled=true;
 view.detailsOpen=false;view.links=[];
 host.classList.add('tv282-relationship-panel');
 host.append(elem('p','tv281-small','Loading deity relationships…'));
 load();
}
function applies(){return view.apply&&view.enabled}
window.TerravaleDivineRelationsV282={mount,applies,impactSummary};
})();