# Coin Shooter: Game Design Document

## Overview

A shooter playable in single-player (against bots) and multiplayer (against other players). Players earn coins by killing enemies and spend them on weapons, gadgets, and health upgrades. One shared core system powers both modes.

## Core Loop

1. Spawn with the starting loadout.
2. Kill enemies or players to earn coins.
3. Spend coins at the shop on weapons, grenades, gadgets, and health.
4. Survive longer, fight tougher enemies, repeat.

## Starting Loadout

- Basic pistol
- Basic melee weapon (knife or bat)
- 3 grenades
- 150 health

The basic pistol is always available, so a player can never be left with nothing.

## Health and Damage

- Everyone starts at 150 health.
- Body shot: normal damage.
- Headshot: double damage (sniper rifle: triple).
- Optional limb shots: 75% damage.
- Example: a 20-damage pistol takes 8 body shots or 4 headshots to kill a 150-health player.

## Coin Economy

- Coins come only from kills.
- Bonus coins for headshot kills, kill streaks, and melee kills (double coins).
- Tougher bots pay more in single-player.
- Multiplayer: kills on real players pay more.
- Bounty system: the player with the most coins is worth extra to kill, which stops runaway leaders.
- Dying costs some coins and/or upgraded weapons, so there is real risk.

## Weapons (cheap to expensive)

- Shotgun: strong up close, slow reload
- SMG: fast fire, low damage per bullet
- Assault rifle: balanced all-rounder
- Sniper rifle: one-shot potential, very slow
- Crossbow: silent, bolts can be picked up
- Flamethrower: burns over time, blocks paths
- Rocket launcher: huge blast, can hurt the user
- Minigun: slows the player, shreds enemies
- Laser rifle: endgame, no recoil, uses an energy meter

## Melee Ladder

Knife, baseball bat, machete, energy blade.

## Grenades and Gadgets

Frag grenades, smoke grenades, flashbangs, sticky bombs, proximity mines, deployable turret, placeable shield.

## Upgrades

- Health tiers: +25, +50, +100 max health, each costing more than the last.
- Max health cap: 300, so no one becomes unkillable.
- Med kit: cheaper one-time quick heal, separate from permanent upgrades.
- Helmet: reduces headshot damage.
- Weapon upgrades: bigger magazines, faster reload.
- Scale weapon damage up in later tiers so headshots still matter at high health.

## Game Modes

**Single-player:** wave-based survival against bots. Bots drop coins, and players shop between waves.

**Multiplayer:** players fight each other in an arena with shop stations on the map. Kills on real players pay more, and the bounty system pressures the coin leader.

## Technical Plan

- Build one shared weapon system, coin system, and shop.
- Layer the two game modes on top.
- Prototype first: pistol, coins, shop, one extra gun, and health upgrades.
- Suggested engines: Godot or Unity (both handle single-player and multiplayer well).

## Open Questions

- Does health regenerate over time, or only through pickups and shop items?
- Which engine and language to use?
- Art style: realistic, low-poly, or pixel art?
