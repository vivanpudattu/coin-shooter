// Shop system: a catalog of items and a purchase function. The buyer is any
// Fighter and the payer is any Wallet, so the same shop works for shop stations
// in multiplayer. The UI lives separately in src/ui/shopUI.js.

CS.HEALTH_CAP = 300;
CS.HEALTH_TIERS = [
  { amount: 25, price: 100 },
  { amount: 50, price: 250 },
  { amount: 100, price: 500 },
];

CS.Shop = class Shop {
  constructor(bus, catalog = CS.Shop.defaultCatalog()) {
    this.bus = bus;
    this.items = catalog;
  }

  // Item names, descriptions and prices may depend on the buyer, so resolve them per call.
  resolve(item, buyer, wallet) {
    const val = v => (typeof v === 'function' ? v(buyer) : v);
    const status = item.status(buyer);
    const price = item.price(buyer);
    const affordable = wallet.canAfford(price);
    return {
      id: item.id,
      category: item.category,
      name: val(item.name),
      desc: val(item.desc),
      price,
      blocked: !status.ok,
      available: status.ok && affordable,
      reason: !status.ok ? status.reason : affordable ? '' : 'Not enough coins',
    };
  }

  list(buyer, wallet) {
    return this.items.map(item => this.resolve(item, buyer, wallet));
  }

  purchase(buyer, wallet, id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return { ok: false, reason: 'Unknown item' };
    const info = this.resolve(item, buyer, wallet);
    if (!info.available) return { ok: false, reason: info.reason, name: info.name };
    wallet.spend(info.price, 'shop:' + id);
    item.apply(buyer);
    this.bus?.emit('shop:purchase', { buyerId: buyer.id, itemId: id, price: info.price });
    return { ok: true, name: info.name, price: info.price };
  }

  static defaultCatalog() {
    const OK = { ok: true };
    const owned = { ok: false, reason: 'Owned' };

    const gun = (id, price, desc) => ({
      id: 'gun:' + id, category: 'Guns', name: CS.WEAPONS[id].name, desc,
      price: () => price,
      status: b => (b.arsenal.has(id) ? owned : OK),
      apply: b => b.arsenal.addGun(id),
    });

    // One-time upgrade tracked by a flag on fighter.upgrades.
    const upgrade = (id, category, name, desc, price, flag, apply) => ({
      id, category, name, desc,
      price: () => price,
      status: b => (b.upgrades[flag] ? owned : OK),
      apply: b => { b.upgrades[flag] = true; apply(b); },
    });

    const nextTier = b => CS.HEALTH_TIERS[b.upgrades.healthTier];
    const tierGain = b => Math.min(nextTier(b).amount, CS.HEALTH_CAP - b.maxHealth);

    return [
      gun('shotgun', 120, 'Huge damage up close. Slow reload.'),
      gun('smg', 200, 'Very fast fire, low damage per bullet.'),
      gun('rifle', 350, 'Balanced automatic all-rounder.'),
      gun('sniper', 550, 'Triple headshot damage. Very slow.'),
      {
        id: 'melee:bat', category: 'Melee', name: 'Baseball Bat', desc: 'Hits harder and reaches further than the knife.',
        price: () => 150,
        status: b => (b.arsenal.melee.id === 'bat' ? owned : OK),
        apply: b => b.arsenal.setMelee('bat'),
      },
      {
        id: 'health:max', category: 'Health',
        name: b => (nextTier(b) && b.maxHealth < CS.HEALTH_CAP ? `Max Health +${tierGain(b)}` : 'Max Health'),
        desc: b => `Permanent. Tier ${Math.min(b.upgrades.healthTier + 1, CS.HEALTH_TIERS.length)} of ${CS.HEALTH_TIERS.length}, cap ${CS.HEALTH_CAP}.`,
        price: b => nextTier(b)?.price ?? 0,
        status: b => (!nextTier(b) || b.maxHealth >= CS.HEALTH_CAP ? { ok: false, reason: 'Maxed' } : OK),
        apply: b => {
          const gain = tierGain(b);
          b.maxHealth += gain;
          b.health += gain;
          b.upgrades.healthTier++;
        },
      },
      {
        id: 'health:medkit', category: 'Health', name: 'Med Kit', desc: 'Heal 75 health now.',
        price: () => 40,
        status: b => (b.health >= b.maxHealth ? { ok: false, reason: 'Full health' } : OK),
        apply: b => b.heal(75),
      },
      upgrade('gear:helmet', 'Gear', 'Helmet', 'Takes 35% off headshot damage you receive.', 200, 'helmet', () => {}),
      {
        id: 'gear:grenade', category: 'Gear', name: 'Frag Grenade',
        desc: b => `Carrying ${b.arsenal.grenades} of ${b.arsenal.maxGrenades}.`,
        price: () => 30,
        status: b => (b.arsenal.grenades >= b.arsenal.maxGrenades ? { ok: false, reason: 'Carrying max' } : OK),
        apply: b => { b.arsenal.grenades++; },
      },
      upgrade('mod:mags', 'Weapon Mods', 'Extended Mags', '+50% magazine size on every gun.', 180, 'extMags',
        b => { b.arsenal.mods.magMult = 1.5; b.arsenal.refillAll(); }),
      upgrade('mod:reload', 'Weapon Mods', 'Fast Hands', 'Reload 30% faster.', 160, 'fastHands',
        b => { b.arsenal.mods.reloadMult = 0.7; }),
    ];
  }
};
