// Stand-ins for the two HA elements the card uses: ha-card and ha-icon.
// Icons are fetched from the MDI SVG set (needs a network connection) so the harness and the
// gallery show the real glyphs.

const iconCache = new Map<string, Promise<string>>();

function loadPath(name: string): Promise<string> {
  let p = iconCache.get(name);
  if (!p) {
    p = fetch(`https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/${name}.svg`)
      .then((r) => (r.ok ? r.text() : ''))
      .then((svg) => /\sd="([^"]+)"/.exec(svg)?.[1] ?? '')
      .catch(() => '');
    iconCache.set(name, p);
  }
  return p;
}

class HaCard extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' }).innerHTML = `
      <style>:host{display:block;position:relative;overflow:hidden;
        background:var(--ha-card-background, var(--card-background-color, #fff));
        border-radius:var(--ha-card-border-radius, 12px);
        border:1px solid var(--ha-card-border-color, var(--divider-color, #e0e0e0))}</style>
      <slot></slot>`;
  }
}

class HaIcon extends HTMLElement {
  static observedAttributes = ['icon'];
  private _icon?: string;
  set icon(value: string | undefined) {
    this._icon = value;
    void this.paint();
  }
  get icon() {
    return this._icon;
  }
  attributeChangedCallback(_name: string, _old: string | null, value: string | null) {
    this.icon = value ?? undefined;
  }
  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' }).innerHTML = `
        <style>:host{display:inline-flex;align-items:center;justify-content:center;
          width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);flex:none}
          svg{width:100%;height:100%;fill:currentColor}</style>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d=""></path></svg>`;
    }
    void this.paint();
  }
  private async paint() {
    const name = this._icon?.replace(/^mdi:/, '');
    const path = name ? await loadPath(name) : '';
    this.shadowRoot?.querySelector('path')?.setAttribute('d', path);
  }
}

customElements.define('ha-card', HaCard);
customElements.define('ha-icon', HaIcon);
