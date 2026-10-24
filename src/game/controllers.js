// Controllers turn "who is deciding" into an intent the World understands:
// { moveX, jump, drop, aim, firePressed, fireHeld, reload, melee, grenade, switchTo, cycle }.
// A future NetworkController would produce the same shape from received packets.

CS.IDLE_INTENT = Object.freeze({ moveX: 0 });

CS.HumanController = class HumanController {
  constructor(input) { this.input = input; }

  getIntent(f) {
    const i = this.input, o = f.gunOrigin();
    const down = (...codes) => codes.some(c => i.isDown(c));
    const pressed = (...codes) => codes.some(c => i.wasPressed(c));
    let switchTo = null;
    for (let n = 1; n <= 9; n++) if (i.wasPressed('Digit' + n)) switchTo = n - 1;
    return {
      moveX: (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0),
      jump: down('KeyW', 'Space', 'ArrowUp'),
      drop: pressed('KeyS', 'ArrowDown'),
      aim: Math.atan2(i.mouse.y - o.y, i.mouse.x - o.x),
      fireHeld: i.mouse.down,
      firePressed: i.mousePressed,
      reload: pressed('KeyR'),
      melee: pressed('KeyF', 'KeyV') || i.rightPressed,
      grenade: pressed('KeyG', 'KeyQ'),
      switchTo,
      cycle: i.wheel,
    };
  }
};

// Bot AI tuned by a profile (see CS.BOT_TYPES in the wave mode).
CS.BotController = class BotController {
  constructor(profile) {
    this.p = profile;
    this.fireTimer = CS.M.rand(0.6, 1.4); // reaction delay before the first shot
    this.burstLeft = 0;
    this.jumpCooldown = 0;
    this.stuckFor = 0;
    this.wander = 0; this.wanderTimer = 0;
    this.aimOffset = 0; this.aimHead = false; this.aimTimer = 0;
  }

  getIntent(f, world, dt) {
    const target = world.nearestEnemy(f);
    if (!target) return CS.IDLE_INTENT;
    const M = CS.M, p = this.p, gun = f.arsenal.gun;
    const dx = target.x - f.x, dy = target.y - f.y, adx = Math.abs(dx), dir = Math.sign(dx) || 1;

    // Move to the preferred range, back off when too close, drift a little in between.
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) { this.wanderTimer = M.rand(0.7, 1.8); this.wander = M.pick([-1, 0, 0, 1]); }
    let moveX;
    if (p.meleeOnly || adx > p.preferredRange + 40 || Math.abs(dy) > 90) moveX = dir;
    else if (adx < p.preferredRange * 0.45) moveX = -dir;
    else moveX = this.wander * 0.6;

    this.stuckFor = moveX !== 0 && f.onGround && Math.abs(f.vx) < 15 ? this.stuckFor + dt : 0;
    this.jumpCooldown -= dt;
    let jump = false;
    if (f.onGround && this.jumpCooldown <= 0 && ((dy < -90 && adx < 220) || this.stuckFor > 0.2 || Math.random() < 0.003)) {
      jump = true;
      this.jumpCooldown = M.rand(0.7, 1.5);
    }
    const drop = f.onGround && dy > 90 && f.y < world.map.groundY - 1 && adx < 400;

    // Aim: re-roll the error and head/body choice every so often.
    this.aimTimer -= dt;
    if (this.aimTimer <= 0) {
      this.aimTimer = M.rand(0.25, 0.6);
      this.aimOffset = M.rand(-1, 1) * (p.aimError || 0);
      this.aimHead = Math.random() < (p.headChance || 0);
    }
    const o = f.gunOrigin(), ty = target.y - (this.aimHead ? 56 : 36);
    const aim = Math.atan2(ty - o.y, target.x - o.x) + this.aimOffset;

    let firePressed = false, fireHeld = false, melee;
    if (p.meleeOnly) {
      melee = adx < 52 && Math.abs(dy) < 44;
    } else {
      const canShoot = Math.hypot(dx, dy) < gun.def.range * 0.85 && world.lineOfSight(o.x, o.y, target.x, ty);
      this.fireTimer -= dt;
      if (gun.def.auto) {
        if (this.burstLeft > 0) { this.burstLeft -= dt; fireHeld = canShoot; }
        else if (canShoot && this.fireTimer <= 0) {
          this.burstLeft = M.rand(0.25, 0.6);
          this.fireTimer = this.burstLeft + (p.burstPause || 1.2) * M.rand(0.8, 1.5);
        }
      } else if (canShoot && this.fireTimer <= 0) {
        firePressed = true;
        this.fireTimer = (p.fireDelay || 2) * M.rand(0.7, 1.3);
      }
      melee = adx < 40 && Math.abs(dy) < 40 && Math.random() < 0.05;
    }
    return { moveX, jump, drop, aim, firePressed, fireHeld, melee };
  }
};
