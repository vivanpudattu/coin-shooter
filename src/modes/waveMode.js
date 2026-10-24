// Single-player wave survival. Owns only this mode's rules: spawning, wave
// progression, kill rewards, streaks and game over. Weapons, coins and the shop
// are the shared systems in src/core.

CS.BOT_TYPES = {
  grunt:    { name: 'Grunt',    health: 60,  weapon: 'pistol',  speed: 170, coinValue: 10, color: '#d9534f', aimError: 0.11, headChance: 0.08, preferredRange: 380, fireDelay: 2.4, minWave: 1, weight: 10 },
  runner:   { name: 'Runner',   health: 45,  weapon: null,      speed: 310, coinValue: 12, color: '#f0883e', meleeOnly: true, preferredRange: 0, minWave: 2, weight: 4 },
  soldier:  { name: 'Soldier',  health: 100, weapon: 'smg',     speed: 190, coinValue: 20, color: '#8957e5', aimError: 0.09, headChance: 0.1, preferredRange: 320, burstPause: 1.5, minWave: 3, weight: 6 },
  brute:    { name: 'Brute',    health: 220, weapon: 'shotgun', speed: 135, coinValue: 35, color: '#7d2e2e', aimError: 0.06, headChance: 0.05, preferredRange: 170, fireDelay: 1.8, minWave: 4, weight: 3 },
  rifleman: { name: 'Rifleman', health: 120, weapon: 'rifle',   speed: 180, coinValue: 30, color: '#2ea043', aimError: 0.07, headChance: 0.12, preferredRange: 520, burstPause: 1.6, minWave: 6, weight: 4 },
};

CS.STREAK_WINDOW = 5; // seconds between kills to keep a streak going

CS.WaveMode = class WaveMode {
  constructor({ bus, input }) {
    this.bus = bus;
    this.input = input;
    this.shop = new CS.Shop(bus);
    this.unsubs = [];
    this.reset();
    this.phase = 'title';
  }

  reset() {
    this.unsubs.forEach(u => u());
    this.world = new CS.World(this.bus, CS.MAPS.arena);
    this.player = this.world.addFighter(new CS.Fighter({
      id: 'p1', name: 'You', team: 'players', x: 640, y: 660, color: '#4da3ff',
      collectsCoins: true, controller: new CS.HumanController(this.input),
    }));
    this.wallets = { p1: new CS.Wallet('p1', this.bus, 0) };
    this.wave = 0;
    this.phase = 'ready';
    this.queue = [];
    this.spawnTimer = 0;
    this.botSeq = 0;
    this.banner = null;
    this.feed = [];
    this.stats = { kills: 0, headshots: 0, meleeKills: 0, bestStreak: 0 };
    this.unsubs = [
      this.bus.on('kill', e => this.onKill(e)),
      this.bus.on('coin:collect', e => this.wallets[e.fighter.id]?.add(e.value, 'pickup')),
    ];
  }

  wallet(f) { return this.wallets[f.id]; }

  aliveBots() { return this.world.fighters.filter(f => f.isBot && f.alive).length; }
  botsRemaining() { return this.queue.length + this.aliveBots(); }

  // Difficulty curve.
  scaling(n) {
    return {
      count: Math.min(30, 3 + n * 2),
      maxAlive: Math.min(10, 3 + Math.floor(n / 2)),
      healthMult: 1 + (n - 1) * 0.07,
      damageMult: Math.min(0.8, 0.42 + (n - 1) * 0.035),
      coinMult: 1 + (n - 1) * 0.05,
      spawnGap: Math.max(0.5, 1.6 - n * 0.08),
    };
  }

  startWave() {
    this.wave++;
    this.phase = 'wave';
    const s = this.scaling(this.wave);
    const types = Object.entries(CS.BOT_TYPES).filter(([, t]) => t.minWave <= this.wave);
    const totalWeight = types.reduce((sum, [, t]) => sum + t.weight, 0);
    this.queue = [];
    for (let i = 0; i < s.count; i++) {
      let r = Math.random() * totalWeight;
      const [id] = types.find(([, t]) => (r -= t.weight) < 0) || types[0];
      this.queue.push(id);
    }
    this.spawnTimer = 1;
    this.banner = { text: `WAVE ${this.wave}`, sub: `${s.count} enemies`, t: 2.2 };
    this.bus.emit('wave:start', { wave: this.wave });
  }

  spawnBot(typeId) {
    const t = CS.BOT_TYPES[typeId], s = this.scaling(this.wave), map = this.world.map;
    // Walk in from either edge, or sometimes drop in from above.
    const fromTop = Math.random() < 0.3;
    const x = fromTop ? CS.M.rand(200, map.width - 200) : (Math.random() < 0.5 ? 20 : map.width - 20);
    const y = fromTop ? -10 : map.groundY;
    const bot = new CS.Fighter({
      id: 'bot' + (++this.botSeq), name: t.name, team: 'bots', isBot: true, x, y,
      maxHealth: Math.round(t.health * s.healthMult), speed: t.speed, damageMult: s.damageMult, color: t.color,
      meta: { type: typeId, coinValue: Math.round(t.coinValue * s.coinMult), meleeOnly: !!t.meleeOnly },
      controller: new CS.BotController(t),
    });
    if (t.weapon && t.weapon !== 'pistol') bot.arsenal.addGun(t.weapon);
    this.world.addFighter(bot);
  }

  update(dt) {
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    for (const f of this.feed) f.t -= dt;
    this.feed = this.feed.filter(f => f.t > 0);

    if (this.phase !== 'wave' && this.phase !== 'dying') { this.world.updateFx(dt); return; }
    this.world.update(dt);

    if (this.phase === 'dying') {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.phase = 'gameover';
        this.bus.emit('game:over', this.summary());
      }
      return;
    }
    if (!this.player.alive) { this.phase = 'dying'; this.deathTimer = 1.6; return; }

    if (this.player.streak && this.world.time - this.player.lastKillAt > CS.STREAK_WINDOW) this.player.streak = 0;

    const s = this.scaling(this.wave);
    this.spawnTimer -= dt;
    if (this.queue.length && this.spawnTimer <= 0 && this.aliveBots() < s.maxAlive) {
      this.spawnBot(this.queue.shift());
      this.spawnTimer = s.spawnGap;
    }
    if (!this.queue.length && this.aliveBots() === 0) this.endWave();
  }

  endWave() {
    this.phase = 'intermission';
    this.world.collectAllCoins(this.player);
    this.world.clearProjectiles();
    this.player.arsenal.refillAll();
    this.player.streak = 0;
    this.banner = { text: `WAVE ${this.wave} CLEARED`, sub: 'Shop opening...', t: 1.5 };
    this.bus.emit('wave:cleared', { wave: this.wave });
  }

  onKill({ killer, victim, zone, source }) {
    if (!victim.isBot || !killer || killer.isBot) return;
    const now = this.world.time;
    killer.streak = now - killer.lastKillAt <= CS.STREAK_WINDOW ? killer.streak + 1 : 1;
    killer.lastKillAt = now;

    const headshot = zone === 'head' && source === 'gun';
    const reward = CS.CoinRules.killReward({
      baseValue: victim.meta.coinValue, headshot, melee: source === 'melee', streak: killer.streak,
    });
    this.world.dropCoins(victim.x, victim.y - 36, reward.total);

    this.stats.kills++;
    if (headshot) this.stats.headshots++;
    if (source === 'melee') this.stats.meleeKills++;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, killer.streak);

    const extras = reward.parts.slice(1).map(p => p.label).join(' + ');
    this.feed.unshift({ text: `${victim.name}  +${reward.total}${extras ? '  ' + extras : ''}`, color: headshot ? '#ffd23f' : '#e6edf3', t: 3 });
    this.feed.length = Math.min(this.feed.length, 5);
  }

  summary() {
    return { wave: this.wave, ...this.stats, coinsEarned: this.wallet(this.player).totalEarned };
  }
};
