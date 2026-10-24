// A fighter is anyone who can shoot: the player, a bot, or (later) a remote player.
// Position (x, y) is the centre of the feet. What it does each frame comes from its
// controller, so swapping a HumanController for a network controller is all
// multiplayer needs at this level.
CS.Fighter = class Fighter {
  constructor(opts) {
    this.id = opts.id;
    this.name = opts.name || opts.id;
    this.team = opts.team;
    this.isBot = !!opts.isBot;
    this.collectsCoins = !!opts.collectsCoins;
    this.controller = opts.controller || null;
    this.color = opts.color || '#4da3ff';
    this.meta = opts.meta || {}; // mode-specific data, e.g. bot type and coin value

    this.x = opts.x; this.y = opts.y;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.aim = 0;
    this.facing = 1;
    this.speed = opts.speed ?? 280;
    this.damageMult = opts.damageMult ?? 1;

    this.maxHealth = opts.maxHealth ?? 150;
    this.health = this.maxHealth;
    this.alive = true;
    this.arsenal = new CS.Arsenal();
    this.upgrades = { healthTier: 0, helmet: false, extMags: false, fastHands: false };

    this.kills = 0;
    this.streak = 0;
    this.lastKillAt = -Infinity;

    // Timers used by the world and renderer.
    this.hurtFlash = 0;
    this.swing = 0;
    this.fireBuffer = 0;
    this.dropThrough = 0;
    this.seed = Math.random() * 10;
  }

  gunOrigin() { return { x: this.x, y: this.y - 42 }; }

  bounds() { return { x: this.x - 12, y: this.y - 64, w: 24, h: 64 }; }

  // Head on top, then torso, then legs. They don't overlap.
  hitZones() {
    const { x, y } = this;
    return [
      { zone: 'head', box: { x: x - 9, y: y - 65, w: 18, h: 17 } },
      { zone: 'torso', box: { x: x - 12, y: y - 48, w: 24, h: 25 } },
      { zone: 'legs', box: { x: x - 10, y: y - 23, w: 20, h: 23 } },
    ];
  }

  takeDamage(amount) {
    if (!this.alive) return 0;
    const dealt = Math.min(this.health, amount);
    this.health -= amount;
    this.hurtFlash = 0.12;
    if (this.health <= 0) { this.health = 0; this.alive = false; }
    return dealt;
  }

  heal(amount) { this.health = Math.min(this.maxHealth, this.health + amount); }

  // Plain-data copy of what this fighter has bought, for saving a run (or sending over a network).
  snapshot() {
    const a = this.arsenal;
    return {
      health: this.health,
      maxHealth: this.maxHealth,
      upgrades: { ...this.upgrades },
      guns: a.guns.map(g => g.id),
      melee: a.melee.id,
      grenades: a.grenades,
      mods: { ...a.mods },
    };
  }

  restore(s) {
    const a = this.arsenal;
    this.maxHealth = Math.min(CS.HEALTH_CAP, s.maxHealth || this.maxHealth);
    this.health = Math.max(1, Math.min(s.health || this.maxHealth, this.maxHealth));
    Object.assign(this.upgrades, s.upgrades);
    Object.assign(a.mods, s.mods);
    for (const id of s.guns || []) if (CS.WEAPONS[id]) a.addGun(id);
    if (CS.MELEE[s.melee]) a.setMelee(s.melee);
    a.grenades = Math.min(a.maxGrenades, s.grenades ?? a.grenades);
    a.refillAll();
  }
};
