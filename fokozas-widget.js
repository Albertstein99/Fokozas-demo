// A small host for the viewport. Every iframe owns its canvas and WASM instance.
(() => {
  if (customElements.get('fokozas-viewport')) return;
  const script = document.currentScript;
  const runtimeData = script.dataset.runtimeId ? document.getElementById(script.dataset.runtimeId) : null;
  const embeddedRuntime = runtimeData ? JSON.parse(runtimeData.textContent).html : null;
  const runtimeUrl = new URL('viewport.html', script.src || document.baseURI);
  const runtimeOrigin = embeddedRuntime === null ? runtimeUrl.origin : window.location.origin;
  // Local HTML files have an opaque origin. Still verify the exact frame window
  // on incoming messages; outgoing commands carry no private information.
  const targetOrigin = runtimeOrigin === 'null' ? '*' : runtimeOrigin;

  class FokozasViewport extends HTMLElement {
    static get observedAttributes() { return ['label']; }

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
          :host([hidden]) { display: none; }
          * { box-sizing: border-box; }
          .panel {
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
          .mark { flex: none; width: 20px; height: 20px; color: #276db3; }
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
          button:focus-visible { outline: 2px solid #276db3; outline-offset: 2px; }
          button svg { width: 18px; height: 18px; }
          iframe { display: block; width: 100%; height: 100%; border: 0; }
          :host(:fullscreen) { width: 100vw; height: 100vh; background: #f9fafc; }
          :host(:fullscreen) .panel { border: 0; border-radius: 0; box-shadow: none; }
          .status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
        </style>
        <section class="panel" aria-label="Geometry figure">
          <header>
            <svg class="mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.5"/>
              <path d="M2 20 22 4" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="17.5" cy="7.6" r="2" fill="#db4d2e" stroke="white"/>
            </svg>
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
          <iframe loading="lazy"></iframe>
        </section>
        <span class="status" role="status"></span>`;
      this.frame = root.querySelector('iframe');
      this.labelNode = root.querySelector('.label');
      this.button = root.querySelector('[data-fullscreen]');
      this.navigationButtons = root.querySelectorAll('[data-navigation]');
      this.onRuntimeMessage = event => {
        if (event.source === this.frame.contentWindow && event.origin === runtimeOrigin
            && event.data?.type === 'fokozas:ready')
          for (const button of this.navigationButtons) button.disabled = false;
      };
      for (const button of this.navigationButtons) {
        button.addEventListener('click', () => {
          this.frame.contentWindow?.postMessage({ type: 'fokozas:navigate',
            action: button.dataset.navigation }, targetOrigin);
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
      this.attributeChangedCallback();
      this.button.hidden = !document.fullscreenEnabled || !this.requestFullscreen;
      document.addEventListener('fullscreenchange', this.onFullscreenChange);
      window.addEventListener('message', this.onRuntimeMessage);
      this.onFullscreenChange();
      if (embeddedRuntime !== null) {
        if (!this.frame.hasAttribute('srcdoc')) this.frame.srcdoc = embeddedRuntime;
      } else if (!this.frame.hasAttribute('src')) this.frame.src = runtimeUrl.href;
    }

    disconnectedCallback() {
      document.removeEventListener('fullscreenchange', this.onFullscreenChange);
      window.removeEventListener('message', this.onRuntimeMessage);
      for (const button of this.navigationButtons) button.disabled = true;
      // Unload the isolated runtime and release its GPU/WASM resources.
      this.frame.removeAttribute('src');
      this.frame.removeAttribute('srcdoc');
    }

    attributeChangedCallback() {
      const label = this.getAttribute('label') || 'Fokozás figure';
      this.labelNode.textContent = label;
      this.frame.title = label;
    }
  }

  customElements.define('fokozas-viewport', FokozasViewport);
})();
