// DOM view for CS.Shop. All rules live in the shop; this only lists items and forwards clicks.
CS.ShopUI = class ShopUI {
  constructor(root, shop, bus) {
    this.root = root;
    this.shop = shop;
    this.message = '';
    this.messageOk = true;
    bus.on('wallet:change', () => { if (this.isOpen) this.render(); });
    root.addEventListener('click', e => {
      const buy = e.target.closest('[data-buy]');
      if (buy && !buy.disabled) this.buy(buy.dataset.buy);
      if (e.target.closest('[data-done]')) {
        this.close();
        this.onDone?.();
      }
    });
  }

  get isOpen() { return !this.root.classList.contains('hidden'); }

  open({ buyer, wallet, title, doneLabel, onDone }) {
    Object.assign(this, { buyer, wallet, title, doneLabel, onDone });
    this.message = '';
    this.render();
    this.root.classList.remove('hidden');
  }

  close() { this.root.classList.add('hidden'); }

  buy(id) {
    const r = this.shop.purchase(this.buyer, this.wallet, id);
    this.message = r.ok ? `Bought ${r.name} for ${r.price}` : `${r.name ? r.name + ': ' : ''}${r.reason}`;
    this.messageOk = r.ok;
    this.render();
  }

  render() {
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const b = this.buyer;
    const cats = [];
    for (const item of this.shop.list(b, this.wallet)) {
      let cat = cats.find(c => c.name === item.category);
      if (!cat) cats.push(cat = { name: item.category, items: [] });
      cat.items.push(item);
    }
    const scroll = this.root.querySelector('.shop')?.scrollTop ?? 0;
    const loadout = `${b.arsenal.guns.map(g => g.def.name).join(', ')} · ${b.arsenal.melee.name}`;

    this.root.innerHTML = `
      <div class="panel shop">
        <div class="shop-head">
          <div>
            <h2>${esc(this.title)}</h2>
            <div class="muted">Health ${Math.ceil(b.health)} / ${b.maxHealth} · Grenades ${b.arsenal.grenades}/${b.arsenal.maxGrenades} · ${esc(loadout)}</div>
          </div>
          <div class="coins"><span class="coin-dot"></span>${this.wallet.balance}</div>
        </div>
        ${cats.map(c => `
          <section class="shop-cat">
            <h3>${esc(c.name)}</h3>
            <div class="shop-grid">
              ${c.items.map(it => `
                <button class="item${it.blocked ? ' owned' : ''}" data-buy="${esc(it.id)}" ${it.available ? '' : 'disabled'}>
                  <span class="name">${esc(it.name)}</span>
                  <span class="desc">${esc(it.desc)}</span>
                  <span class="price">${it.blocked ? esc(it.reason) : `<span class="coin-dot"></span>${it.price}`}</span>
                </button>`).join('')}
            </div>
          </section>`).join('')}
        <div class="shop-foot">
          <div class="msg ${this.messageOk ? 'ok' : 'bad'}">${esc(this.message)}</div>
          <button class="primary" data-done>${esc(this.doneLabel)}</button>
        </div>
      </div>`;
    this.root.querySelector('.shop').scrollTop = scroll;
  }
};
