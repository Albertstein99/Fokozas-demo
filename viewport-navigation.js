// Input stays inside this figure's iframe; camera math is shared with Windows.
function initializeViewportNavigation(module) {
  const canvas = module.canvas;
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
  canvas.addEventListener('pointerdown', event => {
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
  canvas.addEventListener('pointermove', event => {
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
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);
  canvas.addEventListener('auxclick', event => { if (event.button === 1) event.preventDefault(); });
  window.addEventListener('blur', cancel);
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    const delta = Math.max(-800, Math.min(800, event.deltaY * unit));
    const point = position(event);
    zoom(Math.pow(1.2, -delta / 100), point.x, point.y);
  }, { passive: false });
  canvas.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    switch (event.key) {
      case 'ArrowLeft': pan(40, 0); break;
      case 'ArrowRight': pan(-40, 0); break;
      case 'ArrowUp': pan(0, 40); break;
      case 'ArrowDown': pan(0, -40); break;
      case '+': case '=': zoom(1.2); break;
      case '-': case '_': zoom(1 / 1.2); break;
      case 'Home': module._viewport_fit(); break;
      case 'Escape': cancel(); return; // Let the browser also exit fullscreen.
      default: return;
    }
    event.preventDefault();
  });
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.type !== 'fokozas:navigate') return;
    switch (event.data.action) {
      case 'zoom-in': zoom(1.2); break;
      case 'zoom-out': zoom(1 / 1.2); break;
      case 'fit': module._viewport_fit(); break;
    }
  });
  // Public readiness signal; the containing page may be on a different origin.
  window.parent.postMessage({ type: 'fokozas:ready' }, '*');
}
