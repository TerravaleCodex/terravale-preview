/* V2.81 — deity-specific public prose. No numerical favour is derived or exposed. */
(function(){
'use strict';
const voices={
 amora:{silence:'An unspoken heart',ominous:'A bond severed',cold:'Affection withheld',veiled:'A heart unread',watchful:'A gentle pull',favoured:'Held close',domain:'bonds, affection and choices freely made'},
 coeus:{silence:'The record is blank',ominous:'Knowledge condemned',cold:'A sealed archive',veiled:'An unanswered question',watchful:'A margin annotated',favoured:'Inscribed in the record',domain:'knowledge, evidence and disciplined inquiry'},
 errigan:{silence:'The hall is quiet',ominous:'The final sour note',cold:'No encore offered',veiled:'A song unfinished',watchful:'The music finds you',favoured:'A place at the feast',domain:'music, joy, freedom and consequences after celebration'},
 eshael:{silence:'No cradle stirred',ominous:'The shelter closes',cold:'Roots draw inward',veiled:'Life holds its breath',watchful:'A seed protected',favoured:'Under her shelter',domain:'life, family, fertility and protection without possession'},
 fjoras:{silence:'The road says nothing',ominous:'All roads turn away',cold:'A closed crossing',veiled:'A fork unseen',watchful:'A path opens',favoured:'The open road welcomes',domain:'roads, freedom, travel and debts incurred along the way'},
 ixi:{silence:'Cold ashes',ominous:'Consumed without purpose',cold:'The forge refuses',veiled:'An ember waits',watchful:'The coals awaken',favoured:'Tempered in living flame',domain:'fire, ruin, refinement and what is rebuilt afterward'},
 kalma:{silence:'The silence of endings',ominous:'An ending demanded',cold:'The threshold is barred',veiled:'The door remains still',watchful:'A name remembered',favoured:'The final passage entrusted',domain:'death, willing departure, souls and the dignity of endings'},
 kwaeth:{silence:'No whisper carries',ominous:'Every mask unravels',cold:'A thread cut loose',veiled:'A riddle unasked',watchful:'A thread loosely held',favoured:'An unseen door opens',domain:'uncertainty, trickery and the price of concealed truths'},
 luna:{silence:'A moon behind clouds',ominous:'The night turns against you',cold:'The watchfire dims',veiled:'A dream unremembered',watchful:'Moonlight finds your step',favoured:'Beneath a watchful moon',domain:'dreams, vigil, night and the cycles of fate'},
 nyrha:{silence:'The thread is untouched',ominous:'A pattern severed',cold:'A revision refused',veiled:'Another draft is possible',watchful:'A thread catches',favoured:'The web recognises you',domain:'revision, selfhood and impossible possibility'},
 pae:{silence:'Before first light',ominous:'The sun stands witness',cold:'Dawn withheld',veiled:'A horizon uncertain',watchful:'First light on the road',favoured:'Recognised beneath the sun',domain:'dawn, truth, warmth, guidance and justice with restraint'},
 rao:{silence:'No accord spoken',ominous:'Sanctuary withdrawn',cold:'A truce left unanswered',veiled:'Peace not yet sought',watchful:'An olive branch extended',favoured:'A sanctuary freely kept',domain:'peace, honour, surrender and responsibilities that survive it'},
 torridae:{silence:'The standards hang still',ominous:'The banners turn against you',cold:'Orders unanswered',veiled:'A silent muster',watchful:'A place in the formation',favoured:'The standard entrusted',domain:'war, command, soldiers and the cost of battle'},
 tyrius:{silence:'A sea without signs',ominous:'The storm remembers',cold:'A passage denied',veiled:'A tide still turning',watchful:'The current takes notice',favoured:'Safe passage entrusted',domain:'oceans, storms, rescue and the wake every crossing leaves'},
 vaelniv:{silence:'The forest keeps quiet',ominous:'The land refuses you',cold:'The balance unsettled',veiled:'A season not yet known',watchful:'The wild takes notice',favoured:'In the living balance',domain:'nature, stewardship and the cost of disturbed balance'},
 tedegra:{silence:'No sign beneath the veil',ominous:'An ancient warning',cold:'The old ways withdraw',veiled:'An omen unspoken',watchful:'A distant recognition',favoured:'An old promise remembered',domain:'the ancient divine traditions attributed to Tedegra'}
};
function status(key,disposition,context={}){
 const item=voices[String(key||'').toLowerCase()]||{silence:'No omen given',ominous:'A warning',cold:'A quiet refusal',veiled:'Judgement unspoken',watchful:'An attentive gaze',favoured:'A rare blessing',domain:'the patron’s known domain'};
 const rank=['ominous','cold','veiled','watchful','favoured'].includes(disposition)?disposition:null;
 if(key==='nyrha'){
  const n=Number(context.entanglement);
  if(Number.isInteger(n)&&n>=1&&n<=5)
   return {label:['','The thread has touched','A second draft stirs','The web gathers','A revision takes hold','The Unwritten Name'][n],
    description:'Nyrha measures this relationship through Entanglement and Fractures, not ordinary Favour.',tone:'special'};
  return {label:item.silence,description:'Nyrha does not grant ordinary Favour. The web remains unclaimed or unread.',tone:'unknown'};
 }
 return {label:rank?item[rank]:item.silence,
  description:rank?
   'An impression shaped by '+item.domain+'. It does not reveal an exact divine judgement or guarantee a boon.':
   'No confirmed judgement has been shared. This patron’s concerns include '+item.domain+'.',
  tone:rank||'unknown'};
}
window.TerravaleDivineVoicesV281={status,voices};
})();
