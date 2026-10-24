// Shared namespace. Plain scripts (no ES modules) so index.html runs straight from disk.
window.CS = window.CS || {};

// Tiny pub/sub bus. Systems talk through events so a game mode (or, later, a
// network layer) can listen in without the systems knowing about each other.
CS.EventBus = class EventBus {
  constructor() { this.handlers = {}; }

  on(type, fn) {
    (this.handlers[type] ||= []).push(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    const list = this.handlers[type];
    if (list) this.handlers[type] = list.filter(h => h !== fn);
  }

  emit(type, payload) {
    (this.handlers[type] || []).slice().forEach(fn => fn(payload));
  }
};
