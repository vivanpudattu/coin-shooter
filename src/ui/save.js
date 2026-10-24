// Progress kept in this browser between games: coins and bought gear (kept
// forever, even after dying) and the current run's checkpoint (cleared when you die).
CS.Save = {
  COINS_KEY: 'coinShooter.coins',
  GEAR_KEY: 'coinShooter.gear',
  RUN_KEY: 'coinShooter.run',

  // Fighter.snapshot() of everything bought, or null.
  loadGear() {
    try {
      const gear = JSON.parse(localStorage.getItem(this.GEAR_KEY));
      return gear && Array.isArray(gear.guns) ? gear : null;
    } catch {
      return null;
    }
  },

  saveGear(snapshot) {
    try { localStorage.setItem(this.GEAR_KEY, JSON.stringify(snapshot)); } catch {}
  },

  loadCoins() {
    try {
      return Math.max(0, parseInt(localStorage.getItem(this.COINS_KEY), 10) || 0);
    } catch {
      return 0;
    }
  },

  saveCoins(amount) {
    try { localStorage.setItem(this.COINS_KEY, String(amount)); } catch {}
  },

  // { wave: next wave to play, player: Fighter.snapshot() } or null.
  loadRun() {
    try {
      const run = JSON.parse(localStorage.getItem(this.RUN_KEY));
      return run && run.wave >= 1 && run.player ? run : null;
    } catch {
      return null;
    }
  },

  saveRun(wave, player) {
    try { localStorage.setItem(this.RUN_KEY, JSON.stringify({ wave, player })); } catch {}
  },

  clearRun() {
    try { localStorage.removeItem(this.RUN_KEY); } catch {}
  },
};
