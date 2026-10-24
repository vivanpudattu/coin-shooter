// Progress kept in this browser between games: coins (kept forever, even after
// dying) and the current run's checkpoint (cleared when you die).
CS.Save = {
  COINS_KEY: 'coinShooter.coins',
  RUN_KEY: 'coinShooter.run',

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
