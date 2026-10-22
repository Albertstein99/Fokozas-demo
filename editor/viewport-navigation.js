// Input stays inside this figure's iframe; camera math is shared with Windows.
function initializeViewportNavigation(module) {
  const canvas = module.canvas;
  const listeners = [];
  const listen = (target, type, callback, options) => {
    target.addEventListener(type, callback, options);
    listeners.push(() => target.removeEventListener(type, callback, options));
  };
  const pointers = new Map();
  let pointPointer = null;
  const endPoint = cancel => {
    if (pointPointer === null) return;
    pointPointer = null;
    module._point_drag_end(cancel ? 1 : 0);
  };
  const pan = (dx, dy) => module._viewport_pan(dx, dy);
  const zoom = (factor, x = canvas.clientWidth / 2, y = canvas.clientHeight / 2) => {
    if (canvas.clientWidth && canvas.clientHeight)
      module._viewport_zoom(factor, x / canvas.clientWidth, y / canvas.clientHeight);
  };
  const position = event => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.clientWidth / rect.width,
      y: (event.clientY - rect.top) * canvas.clientHeight / rect.height
    };
  };
  const gesture = () => {
    const [a, b] = pointers.values();
    if (!a) return null;
    return b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
      distance: Math.hypot(a.x - b.x, a.y - b.y) } : { ...a, distance: 0 };
  };
  const cancel = () => {
    endPoint(true);
    const ids = [...pointers.keys()];
    pointers.clear();
    canvas.classList.remove('dragging');
    for (const id of ids)
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  };
  module.cancelNavigation = cancel;
  const boundMouseAction = event => [0,1,2,3,4].includes(event.button) ? module.resolveShortcut?.(event) : null;
  const boundMouseButtons = new Set();
  listen(window, 'mousedown', event => boundMouseButtons.delete(event.button), true);
  listen(canvas, 'mousedown', event => {
    const action=boundMouseAction(event);
    if(!action)return;
    event.preventDefault();event.stopPropagation();boundMouseButtons.add(event.button);
    cancel();canvas.focus({preventScroll:true});module.runAction(action);
  });
  for(const type of ['mouseup','auxclick','contextmenu']) listen(window,type,event=>{
    if(!boundMouseButtons.has(event.button))return;
    event.preventDefault();event.stopPropagation();
    if(type==='auxclick')boundMouseButtons.delete(event.button);
  },true);
  listen(window,'blur',()=>boundMouseButtons.clear());
  listen(canvas, 'pointerdown', event => {
    // A mapped middle button triggers its action instead of beginning a pan.
    if(boundMouseAction(event))return; // Keep the following mousedown event.
    if ((event.button !== 0 && event.button !== 1) || pointers.size >= 2) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    const p = position(event);
    if (pointers.size) endPoint(true);
    else if (event.button === 0 && module._point_drag_begin(p.x, p.y)) pointPointer = event.pointerId;
    pointers.set(event.pointerId, position(event));
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
  });
  listen(canvas, 'pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const before = gesture();
    pointers.set(event.pointerId, position(event));
    const after = gesture();
    if (event.pointerId === pointPointer) {
      const p = position(event);
      module._point_drag_move(p.x, p.y);
      return;
    }
    pan(after.x - before.x, after.y - before.y);
    if (before.distance > 0 && after.distance > 0)
      zoom(after.distance / before.distance, after.x, after.y);
  });
  const endPointer = event => {
    if (event.pointerId === pointPointer) {
      if (event.type === 'pointerup') {
        const p = position(event);
        module._point_drag_move(p.x, p.y);
      }
      endPoint(event.type !== 'pointerup');
    }
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!pointers.size) canvas.classList.remove('dragging');
  };
  listen(canvas, 'pointerup', endPointer);
  listen(canvas, 'pointercancel', endPointer);
  listen(canvas, 'lostpointercapture', endPointer);
  listen(canvas, 'auxclick', event => { if (event.button === 1) event.preventDefault(); });
  listen(window, 'blur', cancel);
  listen(canvas, 'wheel', event => {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    const delta = Math.max(-800, Math.min(800, event.deltaY * unit));
    const point = position(event);
    const settings = module.navigationSettings?.() || {};
    zoom(Math.pow(1.2, -delta / 100 * (settings.wheelSensitivity || 1) * (settings.invertWheel ? -1 : 1)), point.x, point.y);
  }, { passive: false });
  const selectTool = tool => {
    if (!module._point_tool_set || !Number.isInteger(tool) || tool < 0 || tool > 4) return false;
    cancel();
    module._point_tool_set(tool);
    module.onPointToolChanged?.(tool);
    return true;
  };
  // The viewer has no editing export. Only the separate app host installs this UI.
  module.selectPointTool = selectTool;
  module.runAction = action => {
    const step = module.navigationSettings?.().panStep || 40;
    const tool = ['tool.move','tool.point','tool.line','tool.circle','tool.conic'].indexOf(action);
    if (tool >= 0) return selectTool(tool);
    switch (action) {
      case 'pan.left': pan(step, 0); break;
      case 'pan.right': pan(-step, 0); break;
      case 'pan.up': pan(0, step); break;
      case 'pan.down': pan(0, -step); break;
      case 'zoom.in': zoom(1.2); break;
      case 'zoom.out': zoom(1 / 1.2); break;
      case 'view.fit': module._viewport_fit(); break;
      case 'cancel': cancel(); selectTool(0); break;
      default: return module.onAction?.(action) === true;
    }
    return true;
  };
  listen(canvas, 'keydown', event => {
    if (event.isComposing) return;
    let action;
    if (module.resolveShortcut) action = module.resolveShortcut(event);
    else {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      action = {ArrowLeft:'pan.left',ArrowRight:'pan.right',ArrowUp:'pan.up',ArrowDown:'pan.down',
        '+':'zoom.in','=':'zoom.in','-':'zoom.out','_':'zoom.out',Home:'view.fit',Escape:'cancel',
        '1':'tool.move','2':'tool.point','3':'tool.line','4':'tool.circle','5':'tool.conic'}[event.key];
    }
    if (!action || (event.repeat && !/^(pan\.|zoom\.)/.test(action))) return;
    if (module.runAction(action) && event.key !== 'Escape') event.preventDefault();
  });
  listen(window, 'message', event => {
    if (module.embedded || event.source !== window.parent || event.data?.type !== 'fokozas:navigate') return;
    switch (event.data.action) {
      case 'zoom-in': zoom(1.2); break;
      case 'zoom-out': zoom(1 / 1.2); break;
      case 'fit': module._viewport_fit(); break;
    }
  });
  // Public readiness signal; the containing page may be on a different origin.
  if (!module.embedded) window.parent.postMessage({ type: 'fokozas:ready' }, '*');
  return () => { cancel(); for (const remove of listeners) remove(); };
}

// Shared theme preference: one media listener per page, never a polling loop.
function appearanceSettings() {
  if (appearanceSettings.state) return appearanceSettings.state;
  const media=window.matchMedia?.('(prefers-color-scheme: dark)');
  let preference='system';
  const valid=value=>['system','light','dark'].includes(value);
  try { const saved=localStorage.getItem('fokozas-theme');if(valid(saved))preference=saved; } catch {}
  const listeners=new Set();
  const state={
    get preference(){return preference;},
    get dark(){return preference==='dark' || (preference==='system' && !!media?.matches);},
    set(value){if(!valid(value))return;preference=value;try{localStorage.setItem('fokozas-theme',value);}catch{}notify();},
    cycle(){this.set({system:"light",light:"dark",dark:"system"}[preference]);},
    subscribe(callback){listeners.add(callback);callback(state);return()=>listeners.delete(callback);}
  };
  function notify(){for(const callback of listeners)callback(state);}
  media?.addEventListener('change',()=>{if(preference==='system')notify();});
  window.addEventListener('storage',event=>{
    if(event.key==='fokozas-theme') {preference=valid(event.newValue)?event.newValue:'system';notify();}
  });
  appearanceSettings.state=state;
  return state;
}
