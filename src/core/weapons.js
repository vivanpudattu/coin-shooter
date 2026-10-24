// Weapon system: weapon data plus per-owner weapon state. It knows nothing about
// the world, coins, the shop or game modes. It only answers "can I fire, and in
// which directions do the bullets go".

CS.WEAPONS = {
  pistol:  { id: 'pistol',  name: 'Pistol',        damage: 20, pellets: 1, fireRate: 4,   magSize: 12, reloadTime: 1.1, spread: 0.025, bulletSpeed: 1600, range: 1100, auto: false, headMult: 2, gunLength: 16, color: '#c9d1d9' },
  shotgun: { id: 'shotgun', name: 'Shotgun',       damage: 14, pellets: 8, fireRate: 1.1, magSize: 6,  reloadTime: 2.4, spread: 0.2,   bulletSpeed: 1300, range: 420,  auto: false, headMult: 2, gunLength: 28, color: '#a0522d' },
  smg:     { id: 'smg',     name: 'SMG',           damage: 11, pellets: 1, fireRate: 12,  magSize: 32, reloadTime: 1.6, spread: 0.07,  bulletSpeed: 1500, range: 800,  auto: true,  headMult: 2, gunLength: 22, color: '#8b949e' },
  rifle:   { id: 'rifle',   name: 'Assault Rifle', damage: 22, pellets: 1, fireRate: 7.5, magSize: 30, reloadTime: 1.9, spread: 0.035, bulletSpeed: 1900, range: 1300, auto: true,  headMult: 2, gunLength: 32, color: '#6e7681' },
  sniper:  { id: 'sniper',  name: 'Sniper Rifle',  damage: 95, pellets: 1, fireRate: 0.8, magSize: 5,  reloadTime: 2.8, spread: 0.003, bulletSpeed: 3200, range: 2200, auto: false, headMult: 3, gunLength: 42, color: '#3fb950' },
};

CS.MELEE = {
  knife: { id: 'knife', name: 'Knife',        damage: 45, range: 58, cooldown: 0.4 },
  bat:   { id: 'bat',   name: 'Baseball Bat', damage: 70, range: 76, cooldown: 0.6 },
};

CS.THROWABLES = {
  frag: { id: 'frag', name: 'Frag Grenade', damage: 120, radius: 150, fuse: 1.8, throwSpeed: 720, selfDamageMult: 0.5 },
};

CS.Weapon = class Weapon {
  constructor(id, mods) {
    this.id = id;
    this.def = CS.WEAPONS[id];
    this.mods = mods; // shared with the owning Arsenal, so upgrades apply to every gun
    this.ammo = this.magSize;
    this.cooldown = 0;
    this.reloadLeft = 0;
  }

  get magSize() { return Math.round(this.def.magSize * this.mods.magMult); }
  get reloadTime() { return this.def.reloadTime * this.mods.reloadMult; }
  get reloading() { return this.reloadLeft > 0; }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        this.reloadLeft = 0;
        this.ammo = this.magSize;
      }
    }
  }

  startReload() {
    if (!this.reloading && this.ammo < this.magSize) this.reloadLeft = this.reloadTime;
  }

  // Returns one direction per pellet, or null when the gun can't fire right now.
  fire(angle) {
    if (this.cooldown > 0 || this.reloading) return null;
    if (this.ammo <= 0) { this.startReload(); return null; }
    this.ammo--;
    this.cooldown = 1 / this.def.fireRate;
    const dirs = [];
    for (let i = 0; i < this.def.pellets; i++) dirs.push(angle + (Math.random() * 2 - 1) * this.def.spread);
    if (this.ammo === 0) this.startReload();
    return dirs;
  }
};

// Everything one fighter carries.
CS.Arsenal = class Arsenal {
  constructor() {
    this.mods = { magMult: 1, reloadMult: 1 };
    this.guns = [new CS.Weapon('pistol', this.mods)]; // the pistol can never be lost
    this.index = 0;
    this.melee = CS.MELEE.knife;
    this.meleeCooldown = 0;
    this.grenades = 3;
    this.maxGrenades = 6;
  }

  get gun() { return this.guns[this.index]; }
  has(id) { return this.guns.some(g => g.id === id); }

  addGun(id) {
    const owned = this.guns.find(g => g.id === id);
    if (owned) { owned.ammo = owned.magSize; return owned; }
    const gun = new CS.Weapon(id, this.mods);
    this.guns.push(gun);
    this.select(this.guns.length - 1);
    return gun;
  }

  setMelee(id) { this.melee = CS.MELEE[id]; }

  select(i) {
    if (i < 0 || i >= this.guns.length || i === this.index) return;
    this.gun.reloadLeft = 0; // switching cancels a reload
    this.index = i;
    this.gun.cooldown = Math.max(this.gun.cooldown, 0.15);
  }

  cycle(dir) {
    const n = this.guns.length;
    this.select(((this.index + dir) % n + n) % n);
  }

  refillAll() {
    for (const g of this.guns) { g.ammo = g.magSize; g.reloadLeft = 0; }
  }

  update(dt) {
    this.gun.update(dt);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
  }
};
