// Minimal DOM + localStorage stubs so we can exercise src/app.js without a
// browser. Covers the full wiring: setup -> taps -> undo -> results -> saved.

class StubClassList {
  constructor() { this.items = new Set(); }
  add(...names) { names.forEach((n) => this.items.add(n)); }
  remove(...names) { names.forEach((n) => this.items.delete(n)); }
  contains(name) { return this.items.has(name); }
}

class StubElement {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this._text = "";
    this.attributes = new Map();
    this.listeners = new Map();
    this.disabled = false;
    this.hidden = false;
    this.className = "";
    this.value = "";
    this.title = "";
    this.classList = new StubClassList();
    this.id = "";
  }
  get textContent() { return this._text; }
  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  set ariaLabel(value) { this.setAttribute("aria-label", value); }
  get ariaLabel() { return this.attributes.get("aria-label") ?? ""; }
  appendChild(child) { this.children.push(child); return child; }
  append(...kids) { for (const k of kids) this.appendChild(k); }
  replaceChildren() { this.children = []; this._text = ""; }
  focus() {}
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  dispatch(type = "click") {
    for (const handler of this.listeners.get(type) ?? []) {
      handler({ preventDefault() {} });
    }
  }
  get text() {
    return (
      this._text +
      this.children
        .filter((c) => c.tagName === "#text" || (c.tagName && c.tagName !== "SCRIPT" && c.tagName !== "STYLE"))
        .map((c) => c.text)
        .join(" ")
    );
  }
  findDescendants(predicate, out = []) {
    for (const child of this.children) {
      if (predicate(child)) out.push(child);
      child.findDescendants(predicate, out);
    }
    return out;
  }
}

class StubDocument {
  constructor(ids) {
    this.byId = new Map();
    for (const [id, tag] of Object.entries(ids)) {
      const el = new StubElement(tag);
      el.id = id;
      this.byId.set(id, el);
    }
  }
  getElementById(id) {
    return this.byId.get(id) ?? null;
  }
  get(id) {
    return this.byId.get(id);
  }
  createElement(tagName) {
    return new StubElement(tagName);
  }
}

class StubLocalStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

module.exports = { StubElement, StubDocument, StubLocalStorage };
