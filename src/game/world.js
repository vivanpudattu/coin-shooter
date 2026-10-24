// Mode-agnostic simulation: movement, bullets, melee, grenades, coin pickups and
// effects. It reports what happened on the event bus ('shot', 'damage', 'kill',
// 'melee', 'explosion', 'coin:collect') and never decides rewards or win
// conditions. Game modes do that.

CS.PHYS = { gravity: 2100, jump: 820, maxFall: 1400, groundAccel: 2800, airAccel: 1500 };

CS.MAPS = {
  arena: {
    width: 1280, height: 720, groundY: 660,
    // One-way platforms: you can jump up through them and press S to drop down.
    platforms: [
      { x: 150, y: 515, w: 250 },
      { x: 880, y: 515, w: 250 },
      { x: 515, y: 380, w: 250 },
    ],
    // Solid blocks stop fighters, bullets and grenades.
    solids: [
      { kind: 'ground', x: -200, y: 660, w: 1680, h: 300 },
      { kind: 'crate', x: 430, y: 608, w: 52, h: 52 },
      { kind: 'crate', x: 798, y: 608, w: 52, h: 52 },
    ],
  },
};

CS.World = class World {
  constructor(bus, map) {
    this.bus = bus;
    this.map = map;
    this.fighters = [];
    this.bullets = [];
    this.grenades = [];
    this.coins = [];
    this.particles = [];
    this.floaters = [];
    this.time = 0;
    this.shake = 0;
  }

  addFighter(f) { this.fighters.push(f); return f; }

  nearestEnemy(f) {
    let best = null, bestD = Infinity;
    for (const o of this.fighters) {
      if (!o.alive || o.team === f.team) continue;
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d < bestD) { best = o; bestD = d; }
    }
    return best;
  }

  lineOfSight(x1, y1, x2, y2) {
    return !this.map.solids.some(s => CS.M.segBox(x1, y1, x2, y2, s) >= 0);
  }

  update(dt) {
    this.time += dt;
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const intent = f.controller ? f.controller.getIntent(f, this, dt) : CS.IDLE_INTENT;
      this.applyIntent(f, intent, dt);
      this.moveFighter(f, dt);
      f.arsenal.update(dt);
      f.hurtFlash = Math.max(0, f.hurtFlash - dt);
      f.swing = Math.max(0, f.swing - dt);
    }
    this.updateBullets(dt);
    this.updateGrenades(dt);
    this.updateCoins(dt);
    this.updateFx(dt);
    // Dead bots disappear; dead players stay so their mode can decide what happens.
    this.fighters = this.fighters.filter(f => f.alive || !f.isBot);
  }

  applyIntent(f, it, dt) {
    const accel = f.onGround ? CS.PHYS.groundAccel : CS.PHYS.airAccel;
    f.vx = CS.M.approach(f.vx, (it.moveX || 0) * f.speed, accel * dt);
    if (it.jump && f.onGround) { f.vy = -CS.PHYS.jump; f.onGround = false; }
    if (it.drop && f.onGround) f.dropThrough = 0.25;

    if (it.aim !== undefined) f.aim = it.aim;
    f.facing = Math.cos(f.aim) >= 0 ? 1 : -1;

    const a = f.arsenal;
    if (it.switchTo != null) a.select(it.switchTo);
    if (it.cycle) a.cycle(Math.sign(it.cycle));
    if (it.reload) a.gun.startReload();

    // Semi-auto clicks are buffered briefly so a slightly early click still fires.
    if (it.firePressed) f.fireBuffer = 0.15;
    const wantsFire = a.gun.def.auto ? it.fireHeld : f.fireBuffer > 0;
    if (wantsFire && f.swing <= 0 && this.fireGun(f)) f.fireBuffer = 0;
    f.fireBuffer = Math.max(0, f.fireBuffer - dt);

    if (it.melee) this.melee(f);
    if (it.grenade) this.throwGrenade(f);
  }

  moveFighter(f, dt) {
    const M = CS.M, map = this.map;
    f.vy = Math.min(f.vy + CS.PHYS.gravity * dt, CS.PHYS.maxFall);
    f.dropThrough = Math.max(0, f.dropThrough - dt);

    f.x += f.vx * dt;
    for (const s of map.solids) {
      if (!M.overlap(f.bounds(), s)) continue;
      const pushLeft = s.x - 12, pushRight = s.x + s.w + 12;
      f.x = f.vx > 0 ? pushLeft : f.vx < 0 ? pushRight
        : (Math.abs(f.x - pushLeft) < Math.abs(f.x - pushRight) ? pushLeft : pushRight);
      f.vx = 0;
    }
    f.x = M.clamp(f.x, 12, map.width - 12);

    const prevY = f.y;
    f.y += f.vy * dt;
    f.onGround = false;
    for (const s of map.solids) {
      if (!M.overlap(f.bounds(), s)) continue;
      if (f.vy > 0) { f.y = s.y; f.onGround = true; }
      else f.y = s.y + s.h + 64;
      f.vy = 0;
    }
    if (f.vy >= 0 && f.dropThrough <= 0) {
      for (const p of map.platforms) {
        if (prevY <= p.y && f.y >= p.y && f.x + 10 > p.x && f.x - 10 < p.x + p.w) {
          f.y = p.y; f.vy = 0; f.onGround = true;
        }
      }
    }
  }

  fireGun(f) {
    const gun = f.arsenal.gun;
    const dirs = gun.fire(f.aim);
    if (!dirs) return false;
    const o = f.gunOrigin();
    for (const a of dirs) {
      this.bullets.push({
        owner: f, team: f.team, def: gun.def, dmgMult: f.damageMult,
        x: o.x, y: o.y,
        vx: Math.cos(a) * gun.def.bulletSpeed, vy: Math.sin(a) * gun.def.bulletSpeed,
        travelled: 0, range: gun.def.range,
      });
    }
    const mx = o.x + Math.cos(f.aim) * (gun.def.gunLength + 10), my = o.y + Math.sin(f.aim) * (gun.def.gunLength + 10);
    this.burst(mx, my, 4, '#ffe28a', 120, 0.08, false, 3);
    this.bus.emit('shot', { fighter: f, weaponId: gun.id });
    return true;
  }

  melee(f) {
    const a = f.arsenal;
    if (a.meleeCooldown > 0) return;
    const m = a.melee;
    a.meleeCooldown = m.cooldown;
    f.swing = 0.22;
    let target = null, bestD = Infinity;
    for (const o of this.fighters) {
      if (!o.alive || o.team === f.team) continue;
      const dx = o.x - f.x, dy = o.y - f.y;
      if (dx * f.facing < -8 || Math.abs(dx) > m.range + 12 || Math.abs(dy) > 48) continue;
      if (Math.abs(dx) < bestD) { target = o; bestD = Math.abs(dx); }
    }
    if (target) {
      target.vx += f.facing * 260;
      this.damageFighter(target, f, m.damage * f.damageMult, {
        zone: 'torso', source: 'melee', weaponId: m.id, x: target.x, y: target.y - 40,
      });
    }
    this.bus.emit('melee', { fighter: f, hit: !!target });
  }

  throwGrenade(f) {
    if (f.arsenal.grenades <= 0) return;
    f.arsenal.grenades--;
    const d = CS.THROWABLES.frag, o = f.gunOrigin();
    this.grenades.push({
      owner: f, team: f.team, def: d, x: o.x, y: o.y, r: 6, fuse: d.fuse,
      vx: Math.cos(f.aim) * d.throwSpeed + f.vx * 0.5,
      vy: Math.sin(f.aim) * d.throwSpeed - 150,
    });
    this.bus.emit('throw', { fighter: f });
  }

  updateBullets(dt) {
    const M = CS.M;
    for (const b of this.bullets) {
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      let bestT = Infinity, hitF = null, hitZone = null;
      for (const s of this.map.solids) {
        const t = M.segBox(b.x, b.y, nx, ny, s);
        if (t >= 0 && t < bestT) bestT = t;
      }
      for (const f of this.fighters) {
        if (!f.alive || f === b.owner || f.team === b.team) continue;
        if (M.segBox(b.x, b.y, nx, ny, f.bounds()) < 0) continue;
        for (const z of f.hitZones()) {
          const t = M.segBox(b.x, b.y, nx, ny, z.box);
          if (t >= 0 && t < bestT) { bestT = t; hitF = f; hitZone = z.zone; }
        }
      }
      if (bestT <= 1) {
        const hx = b.x + (nx - b.x) * bestT, hy = b.y + (ny - b.y) * bestT;
        b.travelled += Math.hypot(hx - b.x, hy - b.y);
        b.x = hx; b.y = hy; b.dead = true;
        if (hitF) {
          this.damageFighter(hitF, b.owner, CS.Combat.gunDamage(b.def, hitZone, hitF, b.dmgMult), {
            zone: hitZone, source: 'gun', weaponId: b.def.id, x: hx, y: hy,
          });
        } else {
          this.burst(hx, hy, 5, '#c9d1d9', 160, 0.25, true, 2);
        }
        continue;
      }
      b.travelled += Math.hypot(nx - b.x, ny - b.y);
      b.x = nx; b.y = ny;
      if (b.travelled > b.range || b.x < -50 || b.x > this.map.width + 50 || b.y < -300 || b.y > this.map.height + 50) b.dead = true;
    }
    this.bullets = this.bullets.filter(b => !b.dead);
  }

  damageFighter(target, attacker, amount, info) {
    if (!target.alive) return;
    amount = Math.max(1, Math.round(amount));
    target.takeDamage(amount);
    const head = info.zone === 'head' && info.source === 'gun';
    this.floaters.push({
      x: info.x, y: info.y - 12, vy: -70, life: 0.8, max: 0.8,
      text: head ? `${amount}!` : `${amount}`, color: head ? '#ffd23f' : '#ffffff', size: head ? 20 : 15,
    });
    if (head) {
      this.floaters.push({ x: target.x, y: target.y - 88, vy: -45, life: 1.0, max: 1.0, text: 'HEADSHOT', color: '#ffd23f', size: 22 });
    }
    this.burst(info.x, info.y, head ? 12 : 6, '#c0392b', head ? 260 : 180, 0.4, true, 3);
    this.bus.emit('damage', { target, attacker, amount, ...info });

    if (!target.alive) {
      if (attacker && attacker !== target) attacker.kills++;
      this.burst(target.x, target.y - 32, 26, target.color, 300, 0.7, true, 4);
      this.bus.emit('kill', { killer: attacker, victim: target, ...info });
    }
  }

  updateGrenades(dt) {
    for (const g of this.grenades) {
      this.stepBody(g, dt, 0.45, 0.82);
      g.fuse -= dt;
      if (g.fuse <= 0) { g.dead = true; this.explode(g); }
    }
    this.grenades = this.grenades.filter(g => !g.dead);
  }

  explode(g) {
    const d = g.def;
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const self = f === g.owner;
      if (!self && f.team === g.team) continue;
      const cx = f.x, cy = f.y - 32;
      const dist = Math.max(0, Math.hypot(cx - g.x, cy - g.y) - 14);
      let dmg = CS.Combat.explosionDamage(d, dist);
      if (dmg <= 0) continue;
      dmg *= self ? d.selfDamageMult : g.owner.damageMult;
      const ang = Math.atan2(cy - g.y, cx - g.x);
      f.vx += Math.cos(ang) * 420;
      f.vy = Math.min(f.vy, -280);
      this.damageFighter(f, g.owner, dmg, { zone: 'torso', source: 'explosion', weaponId: d.id, x: f.x, y: f.y - 70 });
    }
    this.particles.push({ ring: true, x: g.x, y: g.y, r: d.radius, life: 0.3, max: 0.3 });
    this.burst(g.x, g.y, 34, '#ffb347', 420, 0.6, false, 4);
    this.burst(g.x, g.y, 14, '#6e7681', 160, 1.0, false, 7);
    this.shake = Math.max(this.shake, 14);
    this.bus.emit('explosion', { x: g.x, y: g.y, owner: g.owner, radius: d.radius });
  }

  // Splits an amount into coin pickups that burst out of (x, y).
  dropCoins(x, y, amount) {
    amount = Math.round(amount);
    if (amount <= 0) return;
    const pieces = [];
    let left = amount;
    for (const d of [25, 10, 5, 1]) {
      while (left >= d && pieces.length < 12) { pieces.push(d); left -= d; }
    }
    if (left > 0) pieces[pieces.length - 1] += left;
    for (const value of pieces) {
      this.coins.push({
        x, y, value, age: 0, r: value >= 25 ? 8 : value >= 10 ? 7 : 6,
        vx: CS.M.rand(-170, 170), vy: CS.M.rand(-480, -240),
      });
    }
  }

  updateCoins(dt) {
    const collectors = this.fighters.filter(f => f.alive && f.collectsCoins);
    for (const c of this.coins) {
      c.age += dt;
      let near = null, nd = Infinity;
      for (const f of collectors) {
        const d = Math.hypot(f.x - c.x, f.y - 32 - c.y);
        if (d < nd) { near = f; nd = d; }
      }
      if (near && c.age > 0.35 && nd < 170) {
        const sp = 480 + (170 - nd) * 5;
        c.vx = (near.x - c.x) / nd * sp;
        c.vy = (near.y - 32 - c.y) / nd * sp;
        c.x += c.vx * dt; c.y += c.vy * dt;
        if (nd < 24) this.collectCoin(c, near);
      } else {
        this.stepBody(c, dt, 0.35, 0.8);
      }
    }
    this.coins = this.coins.filter(c => !c.dead);
  }

  collectCoin(c, fighter) {
    c.dead = true;
    this.bus.emit('coin:collect', { fighter, value: c.value, x: c.x, y: c.y });
  }

  collectAllCoins(fighter) {
    for (const c of this.coins) this.collectCoin(c, fighter);
    this.coins = [];
  }

  clearProjectiles() {
    this.bullets = [];
    this.grenades = [];
  }

  // Bouncy point physics for grenades and coins.
  stepBody(o, dt, bounce, friction) {
    const M = CS.M, map = this.map;
    const prevY = o.y;
    o.vy = Math.min(o.vy + CS.PHYS.gravity * dt, CS.PHYS.maxFall);

    o.x += o.vx * dt;
    if (o.x < o.r || o.x > map.width - o.r) {
      o.x = M.clamp(o.x, o.r, map.width - o.r);
      o.vx = -o.vx * bounce;
    }
    for (const s of map.solids) {
      if (M.circleBox(o.x, o.y, o.r, s)) { o.x -= o.vx * dt; o.vx = -o.vx * bounce; break; }
    }

    o.y += o.vy * dt;
    let landed = false;
    for (const s of map.solids) {
      if (M.circleBox(o.x, o.y, o.r, s)) {
        o.y -= o.vy * dt;
        if (o.vy > 0) landed = true;
        o.vy = -o.vy * bounce;
        break;
      }
    }
    if (!landed && o.vy > 0) {
      for (const p of map.platforms) {
        if (o.x > p.x && o.x < p.x + p.w && prevY + o.r <= p.y && o.y + o.r >= p.y) {
          o.y = p.y - o.r; o.vy = -o.vy * bounce; landed = true;
          break;
        }
      }
    }
    if (landed) {
      o.vx *= friction;
      if (Math.abs(o.vy) < 60) o.vy = 0;
    }
  }

  burst(x, y, n, color, speed, life, gravity, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size, g: gravity ? 900 : 0 });
    }
  }

  updateFx(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      if (p.ring) continue;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const f of this.floaters) { f.life -= dt; f.y += f.vy * dt; }
    this.floaters = this.floaters.filter(f => f.life > 0);
    this.shake = Math.max(0, this.shake - 40 * dt);
  }
};
