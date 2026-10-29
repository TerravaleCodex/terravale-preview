const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('site-overrides/sheet-live-v091.html','utf8');
const begin=src.indexOf('function hpColor(current,maximum){');
const end=src.indexOf('function healthPanel(){return',begin);
assert(begin>=0&&end>begin,'HP colour scale must be included in live character sheet');
const sandbox={};
vm.runInNewContext(src.slice(begin,end),sandbox,{timeout:1000});
function hue(current,max){const color=sandbox.hpColor(current,max);const match=color.match(/^hsl\((\d+) 76% 43%\)$/);assert(match,'Unexpected HP bar color '+color);return Number(match[1]);}
assert(hue(100,100)>=110,'Full HP should be green');
assert(hue(50,100)>=43&&hue(50,100)<=62,'Half HP should be yellow');
assert(hue(10,100)<=12,'Low HP should be red');
assert(hue(0,100)<=12,'Zero HP should be red');
assert(hue(75,100)>hue(50,100),'HP interpolation must move towards green');
assert(hue(30,100)>hue(10,100),'HP interpolation must move away from red as healing happens');
for(const part of ['background:\${hpColor(hp(),p().hp)}','background:\${hpColor(h,x.hp)}']){
 assert(src.includes(part),'HP meter not using dynamic colour: '+part);
}
console.log('PASS: live sheet HP meters use red at low, yellow at half and green at full');
