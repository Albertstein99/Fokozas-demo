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

// All figures share one lazy WASM runtime and rendering surface; only scene state is per figure.
(() => {
  if (customElements.get('fokozas-viewport')) return;
  const script = document.currentScript;
  const runtimeData = script.dataset.runtimeId ? document.getElementById(script.dataset.runtimeId) : null;
  const embedded = runtimeData ? JSON.parse(runtimeData.textContent) : null;
  const runtimeUrl = new URL('viewer-runtime.js', script.src || document.baseURI);
  const pending = new Map();
  const visible = new Set();
  const connected = new Set();
  document.addEventListener('fullscreenchange', () => {
    for (const widget of connected) widget.onFullscreenChange();
  });
  let runtimePromise, frame = 0, sharedCanvas, runtime, software = false;
  const invalidate = (widget, priority = false) => {
    if (!widget.isConnected || !widget.visible) return;
    pending.set(widget, priority || pending.get(widget) || false);
    if (!frame && !document.hidden) frame = requestAnimationFrame(flush);
  };
  function flush() {
    frame = 0;
    const start = performance.now();
    let count = 0;
    while (pending.size && count < 2 && performance.now()-start < 8) {
      const entry = [...pending].find(([,priority]) => priority) || pending.entries().next().value;
      const widget = entry[0]; pending.delete(widget);
      if (widget.isConnected && widget.visible && widget.instance) widget.render();
      count++;
    }
    if (pending.size && !document.hidden) frame = requestAnimationFrame(flush);
  }
  const intersection = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.setVisible(entry.isIntersecting);
  });
  const resize = new ResizeObserver(entries => {
    for (const entry of entries) invalidate(entry.target);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) for (const widget of visible) invalidate(widget);
  });
  window.addEventListener('resize', () => { for (const widget of visible) invalidate(widget); });
  // One observer per page, including pages that do not use Fokozas settings.
  // Read the surrounding page's CSS instead of giving figures a preference.
  function pageAppearance(widget) {
    const style=getComputedStyle(widget.parentElement || document.documentElement);
    const scheme=style.colorScheme.trim();
    let background=[255,255,255];
    for(let node=widget.parentElement;node;node=node.parentElement){
      const values=getComputedStyle(node).backgroundColor.match(/[\d.]+/g)?.map(Number);
      if(values?.length>=3 && (values.length<4 || values[3]===1)){background=values.slice(0,3);break;}
    }
    const dark=scheme==='dark' || (scheme!=='light' &&
      (background[0]*.2126+background[1]*.7152+background[2]*.0722<128));
    return {dark,background};
  }
  let appearanceFrame=0;
  function refreshAppearance(){
    if(appearanceFrame || !connected.size)return;
    appearanceFrame=requestAnimationFrame(()=>{appearanceFrame=0;for(const widget of connected)widget.updateAppearance();});
  }
  const pageObserver=new MutationObserver(records=>{
    if(records.some(r=>!(connected.has(r.target) && r.attributeName==='data-theme')))refreshAppearance();
  });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change',refreshAppearance);
  async function loadRuntime() {
    if (!runtimePromise) runtimePromise = (async () => {
      sharedCanvas = document.createElement('canvas');
      sharedCanvas.id = 'fokozas-shared-surface';
      sharedCanvas.hidden = true;
      sharedCanvas.width = sharedCanvas.height = 1;
      document.body.append(sharedCanvas);
      let url = runtimeUrl.href;
      if (embedded) url = URL.createObjectURL(new Blob([embedded.module], { type: 'text/javascript' }));
      try {
        const factory = (await import(url)).default;
        runtime = await factory({ canvas: sharedCanvas });
        const backend = runtime._viewer_init();
        if (!backend) throw Error('Neither WebGL2 nor Canvas 2D rendering is available.');
        software = backend === 2;
        sharedCanvas.addEventListener('webglcontextlost', event => event.preventDefault());
        sharedCanvas.addEventListener('webglcontextrestored', () => {
          for (const widget of visible) invalidate(widget);
        });
        return runtime;
      } finally { if (embedded) URL.revokeObjectURL(url); }
    })();
    return runtimePromise;
  }

  class FokozasViewport extends HTMLElement {
    static get observedAttributes() { return ['label','example','borderless']; }

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          :host {
            display: block;
            width: 100%;
            height: var(--fokozas-height, 420px);
            min-height: 220px;
            color: #283a4e;
            font: 14px/1.4 system-ui, sans-serif;
          }
          :host([data-theme="dark"]) {color:#cdddf1;color-scheme:dark;}
          :host([data-theme="dark"]) .panel,:host([data-theme="dark"]) header {background:#202832;border-color:#394554;}
          :host([data-theme="dark"]) button {color:#cdddf1;}
          :host([data-theme="dark"]) button:hover {background:#2d3948;}
          select {background:transparent;color:inherit;border:1px solid #8193a555;border-radius:5px;max-width:75px;padding:3px;}
          :host([hidden]) { display: none; }
          :host([borderless]) .panel {border:0;border-radius:0;box-shadow:none;background:transparent;grid-template-rows:minmax(0,1fr);}
          :host([borderless]) header {display:none;}
          * { box-sizing: border-box; }
          .render-warning {position:absolute;right:8px;bottom:8px;padding:4px 7px;border:1px solid #b48c32;border-radius:6px;background:#fff2ce;color:#624600;font-size:11px;}
          .panel {
            position: relative;
            display: grid;
            grid-template-rows: 48px minmax(0, 1fr);
            height: 100%;
            overflow: hidden;
            background: #f9fafc;
            border: 1px solid #dce2e9;
            border-radius: 12px;
            box-shadow: 0 3px 12px #20334b08;
          }
          header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 12px 0 16px;
            background: #fff;
            border-bottom: 1px solid #e5e9ee;
          }
          .brand-dark {display:none;}
          :host([data-theme="dark"]) .brand-light {display:none;}
          :host([data-theme="dark"]) .brand-dark {display:block;}
          .mark { flex: none; width: 20px; height: 20px; color: #9564cd; }
          .label { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 550; }
          .controls { display: flex; flex: none; gap: 2px; margin-left: auto; }
          button {
            display: grid; place-items: center;
            flex: none; width: 32px; height: 32px;
            padding: 7px; border: 0; border-radius: 6px;
            background: transparent; color: #62758a; cursor: pointer;
          }
          button[hidden] { display: none; }
          button:hover { background: #edf2f7; color: #243b54; }
          button:disabled { opacity: 0.4; cursor: default; background: transparent; }
          button:focus-visible { outline: 2px solid #9564cd; outline-offset: 2px; }
          button svg { width: 18px; height: 18px; }
          canvas { display: block; width: 100%; height: 100%; min-height: 0; touch-action: none; cursor: grab; }
          canvas.dragging { cursor: grabbing; }
          canvas:focus-visible { outline: 2px solid #9564cd; outline-offset: -2px; }
          :host(:fullscreen) { width: 100vw; height: 100vh; background: #f9fafc; }
          :host(:fullscreen) .panel { border: 0; border-radius: 0; box-shadow: none; }
          .status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
        </style>
        <section class="panel" aria-label="Geometry figure">
          <header>
            <!-- FOKOZAS MARK BEGIN --><img class="mark brand-light" alt="" src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%20256%20256%22%20role%3D%22img%22%20aria-label%3D%22Single%20ray%20%C2%B7%20light%20Fokoz%C3%A1s%20logo%22%3E%3Cdefs%3E%3CclipPath%20id%3D%22clip-simple-light-20%22%3E%3Cpath%20d%3D%22M20%2010H236V256H20Z%22%20%2F%3E%3C%2FclipPath%3E%3C%2Fdefs%3E%3Cg%20clip-path%3D%22url%28%23clip-simple-light-20%29%22%3E%3Cg%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%3E%3Cpath%20class%3D%22ray%22%20d%3D%22M120.474134793%2035%20L135.525865207%2035%20L210.609248176%20241.289899283%20A5%205%200%200%201%20205.910785072%20248%20L201.500832383%20248%20A5%205%200%200%201%20196.802369279%20244.710100717%20Z%22%20stroke%3D%22none%22%20stroke-width%3D%2214.144000000000002%22%20opacity%3D%221%22%20fill%3D%22%2374556e%22%20data-end-shape%3D%22horizontal-rounded-corners%22%20data-corner-radius%3D%225%22%20%2F%3E%3Cpath%20d%3D%22M25%20211.096%20H231%20A5%205%200%200%201%20236%20216.096%20V221.904%20A5%205%200%200%201%20231%20226.904%20H25%20A5%205%200%200%201%2020%20221.904%20V216.096%20A5%205%200%200%201%2025%20211.096%20Z%22%20stroke%3D%22none%22%20stroke-width%3D%2215.808000000000002%22%20fill%3D%22%2342384e%22%20data-corner-radius%3D%225%22%20%2F%3E%3Ccircle%20cx%3D%22128%22%20cy%3D%22105%22%20r%3D%2270%22%20stroke%3D%22%238b42cf%22%20stroke-width%3D%2219.136%22%20%2F%3E%3C%2Fg%3E%3Ccircle%20cx%3D%22172.99513267805776%22%20cy%3D%22158.62311101832844%22%20r%3D%2220.5824%22%20fill%3D%22%2342384e%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%2214.335999999999999%22%20paint-order%3D%22stroke%20fill%22%20%2F%3E%3Ccircle%20cx%3D%22194.97052310498123%22%20cy%3D%22219%22%20r%3D%2220.5824%22%20fill%3D%22%2342384e%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%2214.335999999999999%22%20paint-order%3D%22stroke%20fill%22%20%2F%3E%3Ccircle%20cx%3D%22128%22%20cy%3D%2235%22%20r%3D%2221.611520000000002%22%20fill%3D%22%2342384e%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%2214.335999999999999%22%20paint-order%3D%22stroke%20fill%22%20%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E"><img class="mark brand-dark" alt="" src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%20256%20256%22%20role%3D%22img%22%20aria-label%3D%22Single%20ray%20%C2%B7%20dark%20Fokoz%C3%A1s%20logo%22%3E%3Cdefs%3E%3CclipPath%20id%3D%22clip-simple-dark-20%22%3E%3Cpath%20d%3D%22M20%2010H236V256H20Z%22%20%2F%3E%3C%2FclipPath%3E%3C%2Fdefs%3E%3Cg%20clip-path%3D%22url%28%23clip-simple-dark-20%29%22%3E%3Cg%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%3E%3Cpath%20class%3D%22ray%22%20d%3D%22M120.474134793%2035%20L135.525865207%2035%20L210.609248176%20241.289899283%20A5%205%200%200%201%20205.910785072%20248%20L201.500832383%20248%20A5%205%200%200%201%20196.802369279%20244.710100717%20Z%22%20stroke%3D%22none%22%20stroke-width%3D%2214.144000000000002%22%20opacity%3D%221%22%20fill%3D%22%23a3a5b0%22%20data-end-shape%3D%22horizontal-rounded-corners%22%20data-corner-radius%3D%225%22%20%2F%3E%3Cpath%20d%3D%22M25%20211.096%20H231%20A5%205%200%200%201%20236%20216.096%20V221.904%20A5%205%200%200%201%20231%20226.904%20H25%20A5%205%200%200%201%2020%20221.904%20V216.096%20A5%205%200%200%201%2025%20211.096%20Z%22%20stroke%3D%22none%22%20stroke-width%3D%2215.808000000000002%22%20fill%3D%22%23d3d5dc%22%20data-corner-radius%3D%225%22%20%2F%3E%3Ccircle%20cx%3D%22128%22%20cy%3D%22105%22%20r%3D%2270%22%20stroke%3D%22%239959e4%22%20stroke-width%3D%2219.136%22%20%2F%3E%3C%2Fg%3E%3Ccircle%20cx%3D%22172.99513267805776%22%20cy%3D%22158.62311101832844%22%20r%3D%2214.080000000000002%22%20fill%3D%22%23d3d5dc%22%20stroke%3D%22%23191a1e%22%20stroke-width%3D%228.959999999999999%22%20paint-order%3D%22stroke%20fill%22%20%2F%3E%3Ccircle%20cx%3D%22194.97052310498123%22%20cy%3D%22219%22%20r%3D%2214.080000000000002%22%20fill%3D%22%23d3d5dc%22%20stroke%3D%22%23191a1e%22%20stroke-width%3D%228.959999999999999%22%20paint-order%3D%22stroke%20fill%22%20%2F%3E%3Ccircle%20cx%3D%22128%22%20cy%3D%2235%22%20r%3D%2214.784000000000002%22%20fill%3D%22%23d3d5dc%22%20stroke%3D%22%23191a1e%22%20stroke-width%3D%228.959999999999999%22%20paint-order%3D%22stroke%20fill%22%20%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E"><!-- FOKOZAS MARK END -->
            <span class="label"></span>
            <div class="controls" role="group" aria-label="View controls">
            <button type="button" data-navigation="zoom-out" aria-label="Zoom out" title="Zoom out (-)" disabled>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 12h14"/></svg>
            </button>
            <button type="button" data-navigation="zoom-in" aria-label="Zoom in" title="Zoom in (+)" disabled>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>
            </button>
            <button type="button" data-navigation="fit" aria-label="Fit scene" title="Fit scene (Home)" disabled>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="4"/></svg>
            </button>
            <button type="button" data-fullscreen aria-label="Expand figure" title="Expand figure" aria-pressed="false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>
              </svg>
            </button>
            </div>
          </header>
          <canvas tabindex="0" aria-label="Geometry viewport: drag points, pan, zoom, Home to fit"></canvas>
          <span class="render-warning" role="status" tabindex="0" title="Compatibility rendering — WebGL2 is unavailable; rendering may be slower." aria-label="Compatibility rendering — WebGL2 is unavailable; rendering may be slower." hidden>⚠ Compatibility rendering</span>
        </section>
        <span class="status" role="status"></span>`;
      this.canvas = root.querySelector('canvas');
      this.context = this.canvas.getContext('2d', { alpha: false });
      this.instance = 0; this.visible = false; this.generation = 0;
      this.labelNode = root.querySelector('.label');
      this.button = root.querySelector('[data-fullscreen]');
      this.navigationButtons = root.querySelectorAll('[data-navigation]');
      for (const button of this.navigationButtons) {
        button.addEventListener('click', () => {
          if (!this.adapter) return;
          const action = button.dataset.navigation;
          if (action === 'fit') this.adapter._viewport_fit();
          else this.adapter._viewport_zoom(action === 'zoom-in' ? 1.2 : 1/1.2, .5, .5);
          this.canvas.focus({ preventScroll: true });
        });
      }
      this.status = root.querySelector('.status');
      this.onFullscreenChange = () => {
        const expanded = this.matches(':fullscreen');
        const action = expanded ? 'Exit fullscreen' : 'Expand figure';
        this.button.setAttribute('aria-label', action);
        this.button.setAttribute('aria-pressed', String(expanded));
        this.button.title = action;
      };
      this.button.addEventListener('click', async () => {
        try {
          if (this.matches(':fullscreen')) await document.exitFullscreen();
          else await this.requestFullscreen();
          this.status.textContent = '';
        } catch {
          this.status.textContent = 'Fullscreen is unavailable in this page.';
        }
      });
    }

    connectedCallback() {
      this.generation++;
      this.attributeChangedCallback();
      this.button.hidden = !document.fullscreenEnabled || !this.requestFullscreen;
      connected.add(this);
      if(connected.size===1)pageObserver.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class','style','data-theme']});
      this.updateAppearance();
      this.onFullscreenChange();
      intersection.observe(this); resize.observe(this);
    }

    async setVisible(value) {
      this.visible = value;
      if (!value) {
        visible.delete(this); pending.delete(this);
        this.adapter?.cancelNavigation?.();
        // Keep the tiny scene/camera state, release the large per-figure bitmap.
        this.canvas.width = this.canvas.height = 1;
        if (!visible.size && sharedCanvas) sharedCanvas.width = sharedCanvas.height = 1;
        return;
      }
      visible.add(this);
      if (this.instance) { invalidate(this); return; }
      const generation = this.generation;
      try {
        const module = await loadRuntime();
        if (!this.isConnected || generation !== this.generation || !this.visible || this.instance) return;
        this.shadowRoot.querySelector('.render-warning').hidden = !software;
        this.instance = module._viewer_create();
        this.applyExample();
        this.updateAppearance(true);
        const call = (name, ...args) => {
          if (this.visible) this.updateSize();
          const result = module[name](this.instance, ...args);
          invalidate(this, true);
          return result;
        };
        this.adapter = { canvas: this.canvas, embedded: true,
          _point_drag_begin: (x,y) => call('_viewer_begin',x,y),
          _point_drag_move: (x,y) => call('_viewer_move',x,y),
          _point_drag_end: cancel => call('_viewer_end',cancel),
          _viewport_pan: (x,y) => call('_viewer_pan',x,y),
          _viewport_zoom: (factor,x,y) => call('_viewer_zoom',factor,x,y),
          _viewport_fit: () => call('_viewer_fit') };
        this.disposeInput = initializeViewportNavigation(this.adapter);
        for (const button of this.navigationButtons) button.disabled = false;
        this.status.textContent = '';
        invalidate(this);
      } catch (error) { this.status.textContent = 'Figure unavailable: '+error.message; }
    }

    updateSize() {
      const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
      if (!width || !height) return false;
      // Bound per-widget bitmap memory on dense pages and high-DPI devices.
      const scale = Math.min(window.devicePixelRatio || 1, software ? 1 : 1.5, Math.sqrt(500000/(width*height)));
      const w = Math.max(1, Math.round(width*scale)), h = Math.max(1, Math.round(height*scale));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w; this.canvas.height = h;
      }
      runtime._viewer_resize(this.instance,w,h,scale);
      return true;
    }

    render() {
      if (!this.updateSize()) return;
      if (runtime._viewer_draw(this.instance)) {
        this.context.drawImage(sharedCanvas,0,0);
        this.status.textContent = '';
      } else this.status.textContent = 'Rendering unavailable; waiting for graphics recovery.';
    }

    disconnectedCallback() {
      this.generation++; this.visible = false;
      visible.delete(this); pending.delete(this);
      intersection.unobserve(this); resize.unobserve(this);
      connected.delete(this);
      if(!connected.size)pageObserver.disconnect();
      this.disposeInput?.(); this.disposeInput = null; this.adapter = null;
      if (this.instance) runtime._viewer_destroy(this.instance);
      this.instance = 0;
      this.canvas.width = this.canvas.height = 1;
      if (!visible.size && sharedCanvas) sharedCanvas.width = sharedCanvas.height = 1;
      for (const button of this.navigationButtons) button.disabled = true;
    }

    updateAppearance(force=false) {
      const state=pageAppearance(this);
      const key=JSON.stringify([state.dark,this.hasAttribute('borderless'),state.background]);
      if(!force && key===this.appearanceKey)return;
      this.appearanceKey=key;
      this.setAttribute('data-theme',state.dark?'dark':'light');
      if(this.instance){
        runtime._viewer_theme(this.instance,state.dark?1:0);
        if(this.hasAttribute('borderless'))runtime._viewer_background(this.instance,...state.background.map(v=>v/255));
        invalidate(this);
      }
    }

    applyExample() {
      if(!this.instance)return;
      const names=['demo','centroid','circumcenter','orthocenter','euler','nine-point','thales'];
      const name=this.getAttribute('example');
      runtime._viewer_example(this.instance,Math.max(0,names.indexOf(name)));
      this.updateAppearance(true);
      invalidate(this);
    }

    attributeChangedCallback(name) {
      if(name==='example')this.applyExample();
      if(name==='borderless'){this.updateAppearance(true);invalidate(this);}
      const label = this.getAttribute('label') || 'Fokozás figure';
      this.labelNode.textContent = label;
      this.canvas.setAttribute('aria-label', label);
    }
  }

  customElements.define('fokozas-viewport', FokozasViewport);
})();
