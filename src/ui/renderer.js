// Canvas drawing for the world and the HUD. Read-only: it never changes game state.
CS.Renderer = class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // Seeded skyline so it looks the same every run.
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    this.skyline = [];
    for (let x = -10; x < canvas.width;) {
      const w = 50 + rnd() * 90;
      this.skyline.push({ x, w, h: 90 + rnd() * 230 });
      x += w + 6;
    }
  }

  draw(mode, input, paused) {
    const ctx = this.ctx, world = mode.world;
    ctx.save();
    if (world.shake > 0.5) ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
    this.drawBackground(ctx, world.map);
    this.drawMap(ctx, world.map);
    for (const c of world.coins) this.drawCoin(ctx, c, world.time);
    for (const g of world.grenades) this.drawGrenade(ctx, g);
    for (const f of world.fighters) if (f.alive) this.drawFighter(ctx, f, world.time);
    this.drawBullets(ctx, world.bullets);
    this.drawParticles(ctx, world.particles);
    this.drawFloaters(ctx, world.floaters);
    ctx.restore();
    if (mode.phase !== 'title') this.drawHud(ctx, mode);
    if (mode.phase === 'wave' && !paused && mode.player.alive) this.drawCrosshair(ctx, input.mouse, mode.player);
  }

  drawBackground(ctx, map) {
    const g = ctx.createLinearGradient(0, 0, 0, map.height);
    g.addColorStop(0, '#0b1324');
    g.addColorStop(1, '#1f2e4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, map.width, map.height);
    ctx.fillStyle = 'rgba(255,240,200,0.10)';
    this.circle(ctx, 1080, 110, 56);
    for (const b of this.skyline) {
      ctx.fillStyle = '#131d31';
      ctx.fillRect(b.x, map.groundY - b.h, b.w, b.h);
      ctx.fillStyle = 'rgba(255,210,120,0.09)';
      for (let wy = map.groundY - b.h + 14; wy < map.groundY - 24; wy += 22) {
        for (let wx = b.x + 8; wx < b.x + b.w - 12; wx += 16) {
          if ((Math.floor(wx) * 7 + Math.floor(wy) * 13) % 5 < 2) ctx.fillRect(wx, wy, 6, 9);
        }
      }
    }
  }

  drawMap(ctx, map) {
    for (const s of map.solids) {
      if (s.kind === 'ground') {
        ctx.fillStyle = '#2b2722';
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.fillStyle = '#4a4238';
        ctx.fillRect(s.x, s.y, s.w, 6);
      } else {
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeStyle = '#5c3a1a';
        ctx.lineWidth = 3;
        ctx.strokeRect(s.x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);
        ctx.beginPath();
        ctx.moveTo(s.x + 4, s.y + 4); ctx.lineTo(s.x + s.w - 4, s.y + s.h - 4);
        ctx.moveTo(s.x + s.w - 4, s.y + 4); ctx.lineTo(s.x + 4, s.y + s.h - 4);
        ctx.stroke();
      }
    }
    for (const p of map.platforms) {
      ctx.fillStyle = '#34435c';
      ctx.fillRect(p.x, p.y, p.w, 12);
      ctx.fillStyle = '#5b6f91';
      ctx.fillRect(p.x, p.y, p.w, 3);
    }
  }

  drawCoin(ctx, c, t) {
    const squash = Math.max(0.25, Math.abs(Math.cos(t * 5 + c.x * 0.05)));
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.r * squash, c.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  drawGrenade(ctx, g) {
    ctx.fillStyle = '#4b5a33';
    this.circle(ctx, g.x, g.y, g.r);
    const blink = g.fuse < 0.6 ? Math.sin(g.fuse * 60) > 0 : Math.sin(g.fuse * 15) > 0;
    if (blink) { ctx.fillStyle = '#ff4d4d'; this.circle(ctx, g.x, g.y - 3, 2.2); }
  }

  drawFighter(ctx, f, t) {
    const { x, y } = f;
    const moving = f.onGround && Math.abs(f.vx) > 30;
    const step = !f.onGround ? 4 : moving ? Math.sin(t * 16 + f.seed) * 7 : 0;

    ctx.lineCap = 'round';
    ctx.strokeStyle = '#262c38';
    ctx.lineWidth = 7;
    this.line(ctx, x - 3, y - 22, x - 4 + step, y - 3);
    this.line(ctx, x + 3, y - 22, x + 4 - step, y - 3);

    ctx.fillStyle = f.color;
    this.roundRect(ctx, x - 12, y - 48, 24, 28, 6);

    ctx.fillStyle = '#f1c27d';
    this.circle(ctx, x, y - 56, 9);
    ctx.fillStyle = '#111';
    this.circle(ctx, x + f.facing * 4, y - 57, 1.7);
    if (f.upgrades.helmet) {
      ctx.fillStyle = '#556b2f';
      ctx.beginPath();
      ctx.arc(x, y - 57, 10.5, Math.PI, 0);
      ctx.fill();
    }

    // Arm and gun, rotated to the aim and flipped when facing left.
    const def = f.arsenal.gun.def;
    ctx.save();
    ctx.translate(x, y - 42);
    ctx.rotate(f.aim);
    if (Math.cos(f.aim) < 0) ctx.scale(1, -1);
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 5;
    this.line(ctx, 0, 0, 11, 0);
    if (!f.meta.meleeOnly) {
      ctx.fillStyle = def.color;
      ctx.fillRect(8, -3, def.gunLength, 6);
      ctx.fillRect(10, 0, 5, 7);
    }
    ctx.restore();

    if (f.swing > 0) {
      const k = 1 - f.swing / 0.22;
      const a = (f.facing > 0 ? -1.2 : Math.PI + 1.2) + f.facing * k * 2.4;
      const len = f.arsenal.melee.id === 'bat' ? 42 : 28;
      ctx.strokeStyle = f.arsenal.melee.id === 'bat' ? '#c49a6c' : '#e6edf3';
      ctx.lineWidth = f.arsenal.melee.id === 'bat' ? 6 : 3;
      this.line(ctx, x, y - 42, x + Math.cos(a) * len, y - 42 + Math.sin(a) * len);
    }

    if (f.hurtFlash > 0) {
      ctx.globalAlpha = (f.hurtFlash / 0.12) * 0.55;
      ctx.fillStyle = '#fff';
      this.roundRect(ctx, x - 13, y - 66, 26, 66, 7);
      ctx.globalAlpha = 1;
    }

    if (f.isBot) {
      const w = 34, frac = f.health / f.maxHealth;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - w / 2 - 1, y - 79, w + 2, 6);
      ctx.fillStyle = frac > 0.5 ? '#3fb950' : frac > 0.25 ? '#d29922' : '#f85149';
      ctx.fillRect(x - w / 2, y - 78, w * frac, 4);
    }
  }

  drawBullets(ctx, bullets) {
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const b of bullets) {
      const speed = Math.hypot(b.vx, b.vy);
      const tail = Math.min(b.travelled, b.def.id === 'sniper' ? 90 : 22);
      ctx.strokeStyle = b.team === 'bots' ? 'rgba(255,120,90,0.95)' : 'rgba(255,230,140,0.95)';
      this.line(ctx, b.x - b.vx / speed * tail, b.y - b.vy / speed * tail, b.x, b.y);
    }
  }

  drawParticles(ctx, particles) {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      if (p.ring) {
        ctx.strokeStyle = `rgba(255,200,120,${a})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - a * 0.6), 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawFloaters(ctx, floaters) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, f.life / f.max * 2);
      ctx.font = `bold ${f.size}px system-ui, sans-serif`;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  drawHud(ctx, mode) {
    const p = mode.player, wallet = mode.wallet(p), W = this.canvas.width, H = this.canvas.height;
    const frac = p.health / p.maxHealth;
    ctx.save();
    ctx.textBaseline = 'middle';

    if (p.alive && frac < 0.3) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
      g.addColorStop(0, 'rgba(200,0,0,0)');
      g.addColorStop(1, `rgba(200,0,0,${0.35 * (1 - frac / 0.3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // Health and coins.
    this.panel(ctx, 16, 16, 290, 82);
    ctx.fillStyle = '#30363d';
    ctx.fillRect(28, 28, 266, 20);
    ctx.fillStyle = frac > 0.5 ? '#3fb950' : frac > 0.25 ? '#d29922' : '#f85149';
    ctx.fillRect(28, 28, 266 * frac, 20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(p.health)} / ${p.maxHealth}`, 161, 38.5);
    ctx.fillStyle = '#ffd23f';
    this.circle(ctx, 38, 76, 9);
    ctx.fillStyle = '#b8860b';
    this.circle(ctx, 38, 76, 4);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(String(wallet.balance), 54, 77);
    const badges = [p.upgrades.helmet && 'HELMET', p.upgrades.extMags && 'EXT MAGS', p.upgrades.fastHands && 'FAST HANDS'].filter(Boolean);
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillStyle = '#8b949e';
    ctx.textAlign = 'right';
    ctx.fillText(badges.join(' · '), 294, 77);

    // Wave info.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e6edf3';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`WAVE ${mode.wave}`, W / 2, 34);
    if (mode.phase === 'wave') {
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillStyle = '#8b949e';
      ctx.fillText(`${mode.botsRemaining()} enemies left`, W / 2, 60);
    }
    if (p.streak >= CS.CoinRules.STREAK_START) {
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(`STREAK x${p.streak}`, W / 2, 86);
    }

    // Guns.
    const guns = p.arsenal.guns, rowH = 28, top = H - 24 - guns.length * rowH;
    this.panel(ctx, 16, top - 8, 280, guns.length * rowH + 16);
    guns.forEach((g, i) => {
      const y = top + i * rowH + rowH / 2, cur = i === p.arsenal.index;
      ctx.fillStyle = cur ? '#ffd23f' : '#8b949e';
      ctx.font = cur ? 'bold 16px system-ui, sans-serif' : '15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}  ${g.def.name}`, 30, y);
      ctx.textAlign = 'right';
      ctx.fillText(g.reloading ? 'RELOADING' : `${g.ammo} / ${g.magSize}`, 282, y);
      if (cur && g.reloading) {
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(30, y + 11, 252 * (1 - g.reloadLeft / g.reloadTime), 3);
      }
    });

    // Grenades and melee.
    this.panel(ctx, W - 236, H - 74, 220, 58);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4b5a33';
    this.circle(ctx, W - 214, H - 45, 8);
    ctx.fillStyle = '#e6edf3';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`x${p.arsenal.grenades}`, W - 200, H - 45);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#8b949e';
    ctx.fillText('[G]', W - 162, H - 45);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e6edf3';
    ctx.fillText(`[F] ${p.arsenal.melee.name}`, W - 28, H - 45);

    // Kill feed.
    ctx.textAlign = 'right';
    ctx.font = '14px system-ui, sans-serif';
    mode.feed.forEach((e, i) => {
      ctx.globalAlpha = Math.min(1, e.t);
      ctx.fillStyle = e.color;
      ctx.fillText(e.text, W - 20, 28 + i * 22);
    });
    ctx.globalAlpha = 1;

    if (mode.banner) {
      ctx.globalAlpha = Math.min(1, mode.banner.t * 2);
      ctx.textAlign = 'center';
      ctx.font = 'bold 56px system-ui, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(mode.banner.text, W / 2, H / 2 - 90);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(mode.banner.text, W / 2, H / 2 - 90);
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillStyle = '#e6edf3';
      ctx.fillText(mode.banner.sub, W / 2, H / 2 - 44);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawCrosshair(ctx, m, p) {
    const gun = p.arsenal.gun, gap = 5 + gun.def.spread * 110;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    this.line(ctx, m.x - gap - 7, m.y, m.x - gap, m.y);
    this.line(ctx, m.x + gap, m.y, m.x + gap + 7, m.y);
    this.line(ctx, m.x, m.y - gap - 7, m.x, m.y - gap);
    this.line(ctx, m.x, m.y + gap, m.x, m.y + gap + 7);
    ctx.fillStyle = '#fff';
    this.circle(ctx, m.x, m.y, 1.5);
    if (gun.reloading) {
      ctx.strokeStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(m.x, m.y, gap + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - gun.reloadLeft / gun.reloadTime));
      ctx.stroke();
    }
  }

  panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(13,17,23,0.72)';
    this.roundRect(ctx, x, y, w, h, 8);
  }

  line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  }
};
