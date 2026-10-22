// Versioned, host-independent action IDs. UI and input adapters consume this
// model; editing math and construction remain in the shared C++ controller.
function createAppSettings(storage = globalThis.localStorage) {
  const key = 'fokozas-settings-v1';
  const actions = [
    ['tool.move','Move',['1']], ['tool.point','Point',['2']], ['tool.line','Line',['3']],
    ['tool.circle','Circle',['4']], ['tool.conic','Conic',['5']],
    ['point.free','Free point',[]],
    ['point.constrained','Constrained point',[]], ['point.incidence','Incidence point',[]],
    ['point.menu','Point submenu',['Alt+P']], ['view.fit','Fit scene',['Home']],
    ['zoom.in','Zoom in',['Plus','Equal','Shift+Plus']], ['zoom.out','Zoom out',['Minus','Shift+_']],
    ['pan.left','Pan left',['ArrowLeft']], ['pan.right','Pan right',['ArrowRight']],
    ['pan.up','Pan up',['ArrowUp']], ['pan.down','Pan down',['ArrowDown']],
    ['theme.cycle','Cycle theme',['T']], ['settings.open','Settings',['Comma']],
    ['palette.next','Next quick tool',['Q','MouseForward']], ['palette.previous','Previous quick tool',['Shift+Q','MouseBack']],
    ['cancel','Cancel / move',['Escape']]
  ];
  const tools = actions.filter(([id]) => id.startsWith('tool.') || (id.startsWith('point.') && id !== 'point.menu'));
  const defaults = () => ({version:2, bindings:Object.fromEntries(actions.map(([id,,keys]) => [id,[...keys]])),
    graphics:{resolution:'auto',showDegrees:true}, navigation:{wheelSensitivity:1,invertWheel:false,panStep:40},
    palette:tools.slice(0,5).map(([id])=>id)});
  const chord = event => {
    if (event.isComposing || ['Control','Shift','Alt','Meta','Dead','Unidentified'].includes(event.key)) return null;
    let value = typeof event.button==='number' ? ({0:'MouseLeft',1:'MouseMiddle',2:'MouseRight',3:'MouseBack',4:'MouseForward'})[event.button] : event.key;
    if (typeof value !== 'string' || !value) return null;
    value = ({' ':'Space','+':'Plus','-':'Minus','=':'Equal',',':'Comma'})[value] || (value.length===1?value.toUpperCase():value);
    return [event.ctrlKey?'Ctrl':null,event.altKey?'Alt':null,event.shiftKey?'Shift':null,event.metaKey?'Meta':null,value].filter(Boolean).join('+');
  };
  let state = defaults(), storageError = false;
  function validChord(value) {
    if(typeof value!=='string' || value.length>80) return false;
    const parts=value.split('+'), last=parts.pop();
    return !!last && (last.length===1 || /^(Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown|MouseLeft|MouseMiddle|MouseRight|MouseBack|MouseForward|Escape|Tab|Backspace|Delete|Enter|Space|Plus|Minus|Equal|Comma|F([1-9]|1[0-2]))$/.test(last)) &&
      parts.every((p,i)=>['Ctrl','Alt','Shift','Meta'].includes(p) && parts.indexOf(p)===i);
  }
  function load(value) {
    const next=defaults();
    if(value?.version!==1 && value?.version!==2) return next;
    if(value.version===1 && value.bindings) {
      value={...value,bindings:{...value.bindings}};
      for(const [id,key,button] of [['palette.next','Q','MouseForward'],['palette.previous','Shift+Q','MouseBack']]) {
        const keys=value.bindings[id];
        if(Array.isArray(keys) && keys.length===1 && keys[0]===key && !Object.values(value.bindings).some(list=>Array.isArray(list)&&list.includes(button)))
          value.bindings[id]=[key,button];
      }
    }
    // Migrate the former Automatic point alias without losing saved shortcuts.
    if(Array.isArray(value.bindings?.['point.auto']) && Array.isArray(value.bindings?.['tool.point'])) {
      value={...value,bindings:{...value.bindings,'tool.point':[...new Set([
        ...value.bindings['tool.point'],...value.bindings['point.auto']])].slice(0,8)}};
    }
    if(Array.isArray(value.palette)) value={...value,palette:[...new Set(value.palette.map(id=>id==='point.auto'?'tool.point':id))]};
    // Invalid or conflicting bindings reject the saved binding map as a whole.
    if(value.bindings && actions.every(([id])=>Array.isArray(value.bindings[id]) && value.bindings[id].length<=8 && value.bindings[id].every(validChord))) {
      const used=new Set();let valid=true;
      for(const [id] of actions) for(const binding of value.bindings[id]) {if(used.has(binding))valid=false;used.add(binding);}
      if(valid) next.bindings=Object.fromEntries(actions.map(([id])=>[id,[...value.bindings[id]]]));
    }
    if(['auto','1','1.5','2'].includes(value.graphics?.resolution)) next.graphics.resolution=value.graphics.resolution;
    if(typeof value.graphics?.showDegrees==='boolean') next.graphics.showDegrees=value.graphics.showDegrees;
    const n=value.navigation;
    if(n && Number.isFinite(n.wheelSensitivity) && n.wheelSensitivity>=.25 && n.wheelSensitivity<=3) next.navigation.wheelSensitivity=n.wheelSensitivity;
    if(typeof n?.invertWheel==='boolean') next.navigation.invertWheel=n.invertWheel;
    if(Number.isFinite(n?.panStep) && n.panStep>=10 && n.panStep<=120) next.navigation.panStep=n.panStep;
    if(Array.isArray(value.palette) && value.palette.length>0 && value.palette.length<=tools.length &&
      new Set(value.palette).size===value.palette.length && value.palette.every(id=>tools.some(([tool])=>tool===id))) next.palette=[...value.palette];
    return next;
  }
  try { state=load(JSON.parse(storage?.getItem(key)||'null')); } catch { /* Malformed preferences never block startup. */ }
  function save(){try{storage.setItem(key,JSON.stringify(state));storageError=false;}catch{storageError=true;}}
  return {
    actions, tools, chord,
    get state(){return structuredClone(state);}, get storageError(){return storageError;},
    resolve(event){const value=chord(event);return actions.find(([id])=>state.bindings[id].includes(value))?.[0];},
    add(id,binding){
      if(!Object.hasOwn(state.bindings,id) || !validChord(binding)) return 'Unsupported key combination.';
      const conflict=actions.find(([other])=>state.bindings[other].includes(binding));
      if(conflict) return `Already assigned to ${conflict[1]}. Remove that binding first.`;
      if(state.bindings[id].length>=8) return 'Use at most eight bindings per action.';
      state.bindings[id].push(binding);save();return '';
    },
    remove(id,binding){if(Object.hasOwn(state.bindings,id)){state.bindings[id]=state.bindings[id].filter(k=>k!==binding);save();}},
    graphics(value){state=load({...state,graphics:{...state.graphics,resolution:value}});save();},
    degrees(value){state=load({...state,graphics:{...state.graphics,showDegrees:value}});save();},
    navigation(value){state=load({...state,navigation:{...state.navigation,...value}});save();},
    palette(value){state=load({...state,palette:value});save();},
    reset(){state=defaults();save();}
  };
}

function initializeAppSettings(module, openPointMenu, selectPointMode) {
  let storage;try{storage=localStorage;}catch{}
  const settings=createAppSettings(storage || {getItem(){},setItem(){throw Error('Storage unavailable');}});
  const appearance=appearanceSettings();
  const dialog=document.querySelector('#settings-dialog');
  const tabs=dialog.querySelector('[role=tablist]');
  const content=dialog.querySelector('#settings-content');
  const message=dialog.querySelector('#settings-message');
  const quick=document.querySelector('#quick-tools');
  let activeTab='Graphics', recording=null, hideTimer;
  const labels=Object.fromEntries(settings.actions.map(([id,name])=>[id,name]));
  const say=text=>{message.textContent=text || (settings.storageError?'Applied for this session; browser storage is unavailable.':'');};
  function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;}
  function applyGraphics(){
    module._render_scale_set?.(Number(settings.state.graphics.resolution)||0);
    module._degrees_visible_set?.(settings.state.graphics.showDegrees?1:0);
  }
  function hideQuick(){clearTimeout(hideTimer);quick.hidden=true;}
  function delayHide(){clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(!quick.contains(document.activeElement)&&!quick.matches(':hover'))quick.hidden=true;},1600);}
  function showQuick(){
    quick.replaceChildren();
    for(const id of settings.state.palette){
      const b=button('',()=>{module.runAction(id);module.canvas.focus();showQuick();});
      const index=id.startsWith('point.')?1:['tool.move','tool.point','tool.line','tool.circle','tool.conic'].indexOf(id);
      b.append(document.querySelectorAll('#tools .tool')[index].querySelector('svg').cloneNode(true));
      b.title=labels[id];b.setAttribute('aria-label',labels[id]);
      b.setAttribute('aria-pressed',String(id===module.activeAction));quick.append(b);
    }
    quick.hidden=false;delayHide();
  }
  quick.addEventListener('pointerleave',delayHide);quick.addEventListener('focusout',delayHide);
  function cycleQuick(delta){
    const list=settings.state.palette, current=list.indexOf(module.activeAction);
    const index=current<0?(delta>0?0:list.length-1):(current+delta+list.length)%list.length;
    module.runAction(list[index]);showQuick();
  }
  function open(){module.cancelNavigation();hideQuick();recording=null;render();dialog.showModal();}
  function render(){
    content.replaceChildren();say('');
    for(const tab of tabs.children){tab.setAttribute('aria-selected',String(tab.textContent===activeTab));tab.tabIndex=tab.textContent===activeTab?0:-1;}
    content.setAttribute('aria-labelledby','settings-tab-'+activeTab.toLowerCase().replaceAll(' ','-'));
    if(activeTab==='Graphics'){
      const heading=document.createElement('h3');heading.textContent='Appearance';content.append(heading);
      const introduction=document.createElement('p');introduction.textContent='Choose the interface theme. System follows your device.';content.append(introduction);
      const previews=document.createElement('div');previews.className='theme-previews';previews.setAttribute('role','group');previews.setAttribute('aria-label','Interface theme');
      for(const [id,label] of [['system','System'],['light','Light'],['dark','Dark']]){
        const card=button('',()=>{appearance.set(id);for(const item of previews.children)item.setAttribute('aria-pressed',String(item.dataset.themeChoice===id));});
        card.className='theme-preview';card.dataset.themeChoice=id;card.setAttribute('aria-pressed',String(appearance.preference===id));card.setAttribute('aria-label',label+' theme');
        card.innerHTML=`<span class="theme-miniature" aria-hidden="true"><span class="mini-bar"></span><span class="mini-tools">•<br>•<br>•<br>•</span><svg viewBox="0 0 140 90"><circle cx="88" cy="48" r="26"/><path d="M35 78 130 20"/><circle cx="114" cy="48" r="3" fill="currentColor"/></svg><span class="theme-check">✓</span></span><span>${label}</span>`;
        previews.append(card);
      }
      content.append(previews);
      const label=document.createElement('label');label.textContent='Rendering resolution ';
      const select=document.createElement('select');select.setAttribute('aria-label','Rendering resolution');
      for(const [value,name] of [['auto','Automatic'],['1','1×'],['1.5','1.5×'],['2','2×']]){const o=document.createElement('option');o.value=value;o.textContent=name;select.append(o);}
      select.value=settings.state.graphics.resolution;select.onchange=()=>{settings.graphics(select.value);applyGraphics();say('');};label.append(select);content.append(label);
      const hint=document.createElement('p');hint.textContent='Higher resolution uses more memory. Compatibility rendering stays capped at 1×. Theme follows the system by default.';content.append(hint);
      const degreesLabel=document.createElement('label');
      const degrees=document.createElement('input');degrees.type='checkbox';degrees.checked=settings.state.graphics.showDegrees;
      degrees.onchange=()=>{settings.degrees(degrees.checked);applyGraphics();say('');};
      degreesLabel.append(degrees,document.createTextNode(' Show degrees'));content.append(degreesLabel);
      const degreesHint=document.createElement('p');degreesHint.textContent='Show time degrees beside all objects when a constrained point is selected. Independent objects have degree zero.';content.append(degreesHint);
    } else if(activeTab==='Controls'){
      const hint=document.createElement('p');hint.textContent='Add a binding, then press the key combination or mouse button. Each action can have multiple bindings. Escape cancels recording. Browser or system shortcuts may take priority.';content.append(hint);
      for(const [id,name] of settings.actions){
        const row=document.createElement('div');row.className='setting-row';const label=document.createElement('span');label.textContent=name;row.append(label);
        for(const key of settings.state.bindings[id]){const chip=button(key+' ×',()=>{settings.remove(id,key);render();});chip.setAttribute('aria-label',`Remove ${key} from ${name}`);row.append(chip);}
        const add=button('Add binding',()=>{recording=id;say('Press keys or a mouse button for '+name+'…');add.textContent='Press keys…';});add.disabled=recording!==null;row.append(add);content.append(row);
      }
    } else if(activeTab==='Quick tools'){
      const hint=document.createElement('p');hint.textContent='Choose your quick toolbar and its order. Next / Previous quick tool shortcuts briefly show it while switching tools.';content.append(hint);
      const list=settings.state.palette;
      list.forEach((id,index)=>{
        const row=document.createElement('div');row.className='setting-row';const name=document.createElement('span');name.textContent=labels[id];row.append(name);
        for(const [direction,text] of [[-1,'↑'],[1,'↓']]){
          const move=button(text,()=>{const next=[...list];[next[index],next[index+direction]]=[next[index+direction],next[index]];settings.palette(next);render();});
          move.disabled=index+direction<0||index+direction>=list.length;move.setAttribute('aria-label',`Move ${labels[id]} ${direction<0?'earlier':'later'}`);row.append(move);
        }
        const remove=button('Remove',()=>{settings.palette(list.filter(value=>value!==id));render();});remove.disabled=list.length===1;remove.setAttribute('aria-label','Remove '+labels[id]);row.append(remove);content.append(row);
      });
      for(const [id,name] of settings.tools)if(!list.includes(id))content.append(button('Add '+name,()=>{settings.palette([...list,id]);render();}));
    } else {
      for(const [key,name,min,max,step] of [['wheelSensitivity','Wheel zoom speed',.25,3,.25],['panStep','Keyboard pan distance',10,120,10]]){
        const label=document.createElement('label');label.textContent=name+' ';const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=settings.state.navigation[key];
        const value=document.createElement('output');value.textContent=input.value;input.oninput=()=>{settings.navigation({[key]:Number(input.value)});value.textContent=input.value;say('');};label.append(input,value);content.append(label);
      }
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=settings.state.navigation.invertWheel;
      check.onchange=()=>{settings.navigation({invertWheel:check.checked});say('');};label.append(check,' Reverse wheel zoom');content.append(label);
    }
  }
  for(const name of ['Graphics','Controls','Quick tools','Navigation']){
    const tab=button(name,()=>{activeTab=name;recording=null;render();});tab.id='settings-tab-'+name.toLowerCase().replaceAll(' ','-');tab.setAttribute('role','tab');tab.setAttribute('aria-controls','settings-content');tabs.append(tab);
  }
  tabs.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    const list=[...tabs.children],i=list.indexOf(document.activeElement);let next=(i+(event.key==='ArrowDown'?1:list.length-1))%list.length;
    if(event.key==='Home')next=0;if(event.key==='End')next=list.length-1;
    list[next].click();list[next].focus();event.preventDefault();
  });
  const recordBinding=event=>{
    if(!recording)return;
    event.preventDefault();event.stopPropagation();
    if(event.key==='Escape'){recording=null;render();say('Recording cancelled.');return;}
    if(event.repeat)return;
    const key=settings.chord(event);if(!key)return;
    const error=settings.add(recording,key);
    if(error){say(error);return;}
    recording=null;render();say(settings.storageError?'Applied for this session; browser storage is unavailable.':'Binding saved.');
  };
  dialog.addEventListener('keydown',recordBinding);
  installMouseBindingRecorder(window,()=>dialog.open && recording!==null,recordBinding);
  dialog.addEventListener('close',()=>{recording=null;module.canvas.focus();});
  dialog.querySelector('#settings-close').onclick=()=>dialog.close();
  dialog.querySelector('#settings-reset').onclick=()=>{settings.reset();appearance.set("system");recording=null;applyGraphics();render();say('Settings restored to defaults.');};
  document.querySelector('#settings-open').onclick=open;
  module.resolveShortcut=event=>settings.resolve(event);
  module.navigationSettings=()=>settings.state.navigation;
  module.onAction=action=>{
    const mode=['tool.point','point.free','point.constrained','point.incidence'].indexOf(action);
    if(mode>=0){selectPointMode(mode);module.activeAction=action;return true;}
    switch(action){
      case 'point.menu':openPointMenu();break;
      case 'theme.cycle':appearance.cycle();break;
      case 'settings.open':open();break;
      case 'palette.next':cycleQuick(1);break;
      case 'palette.previous':cycleQuick(-1);break;
      default:return false;
    }return true;
  };
  window.addEventListener('blur',hideQuick);
  applyGraphics();
}

// Capture before controls, dialog backdrops, or browser defaults consume the
// gesture. Some hosts only deliver pointer events or release/auxclick events.
function installMouseBindingRecorder(target, isRecording, record) {
  const suppressed=new Map();
  const listeners=[];
  const handle=event=>{
    if(![0,1,2,3,4].includes(event.button) || (event.pointerType && event.pointerType!=='mouse'))return;
    if(event.type==='pointerdown') suppressed.delete(event.button);
    const pending=suppressed.get(event.button);
    if(pending && pending<Date.now())suppressed.delete(event.button);
    const recording=isRecording();
    if(!recording && !suppressed.has(event.button))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(recording && !suppressed.has(event.button)) {
      suppressed.set(event.button,Date.now()+2000);
      record(event);
    }
    if(event.type==='click' || event.type==='auxclick')suppressed.delete(event.button);
  };
  for(const type of ['pointerdown','mousedown','pointerup','mouseup','click','auxclick','contextmenu']){
    target.addEventListener(type,handle,true);listeners.push(()=>target.removeEventListener(type,handle,true));
  }
  const clear=()=>suppressed.clear();target.addEventListener('blur',clear);
  return ()=>{for(const remove of listeners)remove();target.removeEventListener('blur',clear);clear();};
}
