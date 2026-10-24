// Wiring: creates the shared bus, the mode and the UI, and runs the frame loop.
(() => {
  const el = id => document.getElementById(id);
  const show = (id, on) => el(id).classList.toggle('hidden', !on);

  const canvas = el('game');
  const bus = new CS.EventBus();
  const input = new CS.Input(canvas);
  const mode = new CS.WaveMode({ bus, input });
  const renderer = new CS.Renderer(canvas);
  const shopUI = new CS.ShopUI(el('shop'), mode.shop, bus);
  let paused = false;

  // run: a saved checkpoint to continue, or null for a fresh game from wave 1.
  // Coins you already have can be spent in the shop before the first wave.
  function startGame(run) {
    CS.Sfx.init();
    show('title', false);
    show('gameover', false);
    // A new game keeps all bought gear but starts at full health with at least the starter grenades.
    // Saves from before gear was stored separately only have it in the run checkpoint.
    const gear = CS.Save.loadGear() || CS.Save.loadRun()?.player;
    if (!run) CS.Save.clearRun();
    const player = run ? run.player
      : gear ? { ...gear, health: gear.maxHealth, grenades: Math.max(3, gear.grenades) } : null;
    mode.reset({ coins: CS.Save.loadCoins(), wave: run ? run.wave - 1 : 0, player });
    const wallet = mode.wallet(mode.player), next = mode.wave + 1;
    if (wallet.balance > 0) {
      shopUI.open({
        buyer: mode.player, wallet,
        title: run ? `Back to wave ${next}` : 'Get ready',
        doneLabel: `Start wave ${next}`,
        onDone: () => mode.startWave(),
      });
    } else {
      mode.startWave();
    }
  }

  function showMenu() {
    const coins = CS.Save.loadCoins(), run = CS.Save.loadRun();
    el('saved-coins').textContent = `Saved coins: ${coins}`;
    el('saved-coins').classList.toggle('hidden', coins === 0);
    el('btn-continue').classList.toggle('hidden', !run);
    if (run) el('continue-label').textContent = `Continue: Wave ${run.wave}`;
    el('btn-bots').classList.toggle('primary', !run);
    el('btn-bots').querySelector('.mode-desc').textContent = run ? 'New game from wave 1' : 'Survive waves of bots';
    show('gameover', false);
    show('title', true);
  }

  function setPaused(on) {
    paused = on && mode.phase === 'wave';
    show('pause', paused);
  }

  el('btn-continue').onclick = () => startGame(CS.Save.loadRun());
  el('btn-bots').onclick = () => startGame(null);
  el('btn-restart').onclick = () => startGame(null);
  el('btn-menu').onclick = showMenu;
  showMenu();

  // Saving: coins on every change; gear and a run checkpoint at the start and end of
  // each wave and after every shop purchase (the shop only opens before the next wave).
  function saveProgress(nextWave) {
    const snapshot = mode.player.snapshot();
    CS.Save.saveGear(snapshot);
    CS.Save.saveRun(nextWave, snapshot);
  }
  bus.on('wallet:change', e => { if (e.ownerId === mode.player.id) CS.Save.saveCoins(e.balance); });
  bus.on('wave:start', e => saveProgress(e.wave));
  bus.on('wave:cleared', e => saveProgress(e.wave + 1));
  bus.on('shop:purchase', () => saveProgress(mode.wave + 1));
  bus.on('game:over', () => CS.Save.clearRun());
  el('btn-resume').onclick = () => setPaused(false);
  window.addEventListener('blur', () => setPaused(true));

  bus.on('wave:cleared', e => {
    setTimeout(() => {
      if (mode.phase !== 'intermission') return;
      shopUI.open({
        buyer: mode.player,
        wallet: mode.wallet(mode.player),
        title: `Wave ${e.wave} cleared`,
        doneLabel: `Start wave ${e.wave + 1}`,
        onDone: () => mode.startWave(),
      });
    }, 1100);
  });

  bus.on('game:over', s => {
    el('go-stats').innerHTML = `
      <div><b>${s.wave}</b><span>wave reached</span></div>
      <div><b>${s.kills}</b><span>kills</span></div>
      <div><b>${s.headshots}</b><span>headshot kills</span></div>
      <div><b>${s.bestStreak}</b><span>best streak</span></div>
      <div><b>${s.coinsEarned}</b><span>coins earned</span></div>`;
    el('go-saved').textContent = `You keep your ${mode.wallet(mode.player).balance} coins and everything you bought.`;
    show('gameover', true);
  });

  // Sound.
  const isPlayer = f => f === mode.player;
  bus.on('shot', e => CS.Sfx.shot(e.weaponId, isPlayer(e.fighter)));
  bus.on('damage', e => {
    if (isPlayer(e.attacker)) e.zone === 'head' && e.source === 'gun' ? CS.Sfx.headshot() : CS.Sfx.hit();
    else if (isPlayer(e.target)) CS.Sfx.hurt();
  });
  bus.on('melee', e => { if (isPlayer(e.fighter)) CS.Sfx.swing(); });
  bus.on('explosion', () => CS.Sfx.explosion());
  bus.on('coin:collect', () => CS.Sfx.coin());
  bus.on('shop:purchase', () => CS.Sfx.buy());

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) setPaused(!paused);
    if (input.wasPressed('KeyM')) CS.Sfx.toggleMute();
    if (!paused) mode.update(dt);
    renderer.draw(mode, input, paused);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
