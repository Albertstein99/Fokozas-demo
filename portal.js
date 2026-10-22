'use strict';
const examples=[
 {id:'demo',name:'A point, a circle, a joining line',type:'First construction',text:'Move the left purple point freely or drag the purple point around the circle. Their joining line follows both.'},
 {id:'centroid',name:'The centroid',type:'Triangle center',text:'The three medians meet at the centroid. Drag a purple vertex; the gray point stays at their intersection.'},
 {id:'circumcenter',name:'The circumcenter',type:'Triangle center',text:'The gray center is equally far from all three vertices. The circumcircle follows the triangle.'},
 {id:'orthocenter',name:'The orthocenter',type:'Triangle center',text:'The three altitudes meet at the gray point. Move a vertex to see the center leave an obtuse triangle.'},
 {id:'euler',name:'The Euler line',type:'Theorem',text:'The circumcenter, centroid and orthocenter lie on one line. The centroid divides the center-to-center segment in a 1:2 ratio.'},
 {id:'nine-point',name:'The nine-point circle',type:'Theorem',text:'One circle passes through the three side midpoints, the three altitude feet, and the midpoints from the vertices to the orthocenter.'},
 {id:'thales',name:'Thales’ theorem',type:'Theorem',text:'Drag the purple point on the circle. The angle it forms with the fixed endpoints of the diameter remains a right angle.'}
];
const appearance=appearanceSettings();
appearance.subscribe(state=>{
 document.body.dataset.theme=state.dark?'dark':'light';
 document.querySelectorAll('[data-theme-cycle]').forEach(b=>{b.textContent={system:'◐',light:'☀',dark:'☾'}[state.preference];b.title='Theme: '+state.preference+' (click to cycle)';b.setAttribute('aria-label','Theme: '+state.preference+'. Click to cycle.');});
});
document.querySelectorAll('[data-theme-cycle]').forEach(b=>b.addEventListener('click',()=>appearance.cycle()));
function figure(example,label=example.name){const el=document.createElement('fokozas-viewport');el.setAttribute('example',example.id);el.setAttribute('label',label);if(document.querySelector('.notebook'))el.setAttribute('borderless','');return el;}
const gallery=document.querySelector('[data-gallery]');
if(gallery)for(const example of examples){
 const card=document.createElement('article');card.className='construction';card.id=example.id;
 const type=document.createElement('span');type.className='tag';type.textContent=example.type;
 const title=document.createElement('h3');title.textContent=example.name;
 const description=document.createElement('p');description.textContent=example.text;
 card.append(figure(example),title,type,description);gallery.append(card);
}
const wall=document.querySelector('[data-wall]');
if(wall){
 const select=document.querySelector('#figure-count'),status=document.querySelector('#wall-status');
 let generation=0;
 async function populate(){
  const mine=++generation,count=Number(select.value);wall.replaceChildren();status.textContent='Adding figures…';
  for(let i=0;i<count;){
   if(mine!==generation)return;
   const fragment=document.createDocumentFragment();
   for(let end=Math.min(i+20,count);i<end;i++)fragment.append(figure(examples[i%examples.length],`${i+1} · ${examples[i%examples.length].name}`));
   wall.append(fragment);await new Promise(requestAnimationFrame);
  }
  status.textContent=count+' independent figures';
 }
 select.addEventListener('change',populate);
 document.querySelector('#dense').addEventListener('change',e=>wall.classList.toggle('dense',e.target.checked));
 // Update only on visibility/scroll activity; no idle animation or polling loop.
 let queued=false;
 function stats(){queued=false;const all=[...wall.children];const visible=all.filter(e=>e.visible);const allocated=all.filter(e=>e.canvas?.width>1);document.querySelector('#wall-metrics').textContent=`${visible.length} in view · ${allocated.length} canvas buffers`;}
 function scheduleStats(){if(!queued){queued=true;setTimeout(stats,150);}}
 const observer=new IntersectionObserver(scheduleStats);new MutationObserver(records=>{for(const r of records){r.removedNodes.forEach(e=>observer.unobserve(e));r.addedNodes.forEach(e=>observer.observe(e));}scheduleStats();}).observe(wall,{childList:true});
 window.addEventListener('scroll',scheduleStats,{passive:true});window.addEventListener('resize',scheduleStats);populate();
}
if(document.querySelector('[data-download]'))fetch('downloads.json').then(r=>{if(!r.ok)throw Error('Missing download catalog');return r.json();}).then(data=>{
 for(const card of document.querySelectorAll('[data-download]')){
  const entry=data[card.dataset.download],link=card.querySelector('a'),note=card.querySelector('.availability');
  if(entry){link.href=entry.href;link.hidden=false;note.textContent=entry.description+' · '+(entry.bytes/1024/1024).toFixed(1)+' MB';}
  else note.textContent='Not included in this local build yet. Complete homepage bundles from CI include this download.';
 }
}).catch(()=>document.querySelectorAll('.availability').forEach(n=>n.textContent='Download catalog unavailable. Rebuild the homepage bundle.'));
