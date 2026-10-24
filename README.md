# Coin Shooter

A browser-based 2D side-view shooter built from `Coin Shooter Game Design Document.md`.
Single-player wave survival for now; the code is laid out so multiplayer can be added later.

## Play

Open `index.html` in a browser. There is no build step and nothing to install.

| Key | Action |
| --- | --- |
| A / D | Move |
| W / Space | Jump |
| S | Drop through a platform |
| Mouse | Aim |
| Left click | Shoot (hold for SMG / rifle) |
| R | Reload |
| F / Right click | Melee |
| G | Throw grenade |
| 1–9 / Mouse wheel | Switch gun |
| Esc / P | Pause |
| M | Mute |

## Rules implemented

- Start with a pistol, a knife, 3 frag grenades and 150 health. The pistol can never be lost.
- Hit zones: head 2x damage (sniper 3x), torso 1x, legs 0.75x. A helmet takes 35% off headshots you receive.
- Bots drop coins when they die. Walk near the coins to pick them up; any left over are collected when the wave ends.
- Coin bonuses: headshot kill +50%, melee kill x2, kill streaks (kills within 5 seconds of each other).
- Shop between waves: Shotgun, SMG, Assault Rifle, Sniper Rifle, Baseball Bat, max health tiers (+25/+50/+100, capped at 300), Med Kit, Helmet, grenades, Extended Mags and Fast Hands.
- Bot types unlock as the waves go up: Grunt (pistol), Runner (melee), Soldier (SMG), Brute (shotgun), Rifleman. Bots get tougher and pay more each wave.
- Health does not regenerate. You heal only with Med Kits or health upgrades from the shop.

## Saving

Progress is saved in your browser (localStorage), so it survives a refresh:

- **Coins** are saved every time they change and are kept when you die. You can spend them before wave 1 of your next game.
- **Your run** (current wave, guns, upgrades, health, grenades) is saved at the start of each wave, after each wave you clear, and after every shop purchase. After a refresh, the menu shows **Continue: Wave N**. A wave you refresh in the middle of restarts from its beginning. Dying ends the run but keeps your coins.

The start menu has **Bots** (wave survival) and **Multiplayer** (coming soon).

## Code layout

```
src/
  core/          Shared systems: no knowledge of game modes, rendering or input
    events.js    EventBus: the only way systems talk to each other
    weapons.js   Weapon data, Weapon (ammo/reload/fire), Arsenal (what one fighter carries)
    combat.js    Hit-zone and explosion damage rules
    economy.js   Wallet and CoinRules (kill rewards, plus multiplayer hooks: bounty, death penalty)
    shop.js      Shop catalog and purchase(buyer, wallet, itemId)
  game/
    fighter.js   Player/bot entity (health, hit zones, arsenal, upgrades)
    world.js     Mode-agnostic simulation: physics, bullets, melee, grenades, coin pickups
    controllers.js  HumanController (keyboard/mouse) and BotController (AI) -> "intent"
  modes/
    waveMode.js  Single-player rules: waves, spawning, rewards, game over
  ui/            Input, renderer, shop screen, sound
  main.js        Wiring and the frame loop
```

The world reports what happens through events (`shot`, `damage`, `kill`, `explosion`, `coin:collect`)
and never pays out coins itself. The game mode listens and decides. Tuning numbers live in
`CS.WEAPONS`, `CS.MELEE`, `CS.THROWABLES`, `CS.CoinRules`, `CS.HEALTH_TIERS`, the shop catalog and `CS.BOT_TYPES`.

## Adding multiplayer later

1. Add `src/modes/arenaMode.js` next to `waveMode.js`. It creates one `Fighter` and one `Wallet` per player
   (each player on their own team), listens for `kill` and pays with
   `CoinRules.killReward({ victimIsPlayer: true, bounty: CoinRules.bounty(...) })`, and applies
   `CoinRules.deathPenalty` on respawn.
2. Add a `NetworkController` that returns the same intent object as `HumanController`
   (`{ moveX, jump, aim, fireHeld, ... }`) from received input packets. Remote fighters use it; the World doesn't change.
3. For shop stations, call the same `shop.purchase(fighter, wallet, itemId)` when a player stands at a station.
   On an authoritative server, run `World` + the mode there and only send intents up and state down.
