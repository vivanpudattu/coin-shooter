// Coin system: wallets and reward rules. Game modes decide when to pay out;
// this file only decides how much.

CS.Wallet = class Wallet {
  constructor(ownerId, bus, balance = 0) {
    this.ownerId = ownerId;
    this.bus = bus;
    this.balance = balance;
    this.totalEarned = 0;
  }

  canAfford(amount) { return this.balance >= amount; }

  add(amount, reason) {
    amount = Math.round(amount);
    if (amount <= 0) return;
    this.balance += amount;
    this.totalEarned += amount;
    this.bus.emit('wallet:change', { ownerId: this.ownerId, balance: this.balance, delta: amount, reason });
  }

  spend(amount, reason) {
    if (!this.canAfford(amount)) return false;
    this.balance -= amount;
    this.bus.emit('wallet:change', { ownerId: this.ownerId, balance: this.balance, delta: -amount, reason });
    return true;
  }
};

CS.CoinRules = {
  HEADSHOT_BONUS: 0.5,    // +50% of the base value
  MELEE_MULT: 2,          // melee kills pay double
  STREAK_START: 3,        // streak bonus kicks in on the 3rd quick kill
  STREAK_BONUS_PER: 3,
  STREAK_BONUS_MAX: 24,
  PLAYER_KILL_MULT: 2,    // multiplayer: real players are worth more than bots
  DEATH_PENALTY: 0.25,    // multiplayer: share of coins lost on death
  BOUNTY_SHARE: 0.1,      // multiplayer: extra paid for killing the coin leader

  // Returns { total, parts } so the UI can show where the coins came from.
  killReward({ baseValue, headshot = false, melee = false, streak = 0, victimIsPlayer = false, bounty = 0 }) {
    const parts = [{ label: 'Kill', amount: baseValue }];
    let total = baseValue;
    if (victimIsPlayer) {
      const extra = baseValue * (this.PLAYER_KILL_MULT - 1);
      total += extra; parts.push({ label: 'Player kill', amount: extra });
    }
    if (headshot) {
      const extra = Math.round(baseValue * this.HEADSHOT_BONUS);
      total += extra; parts.push({ label: 'Headshot', amount: extra });
    }
    if (melee) {
      const extra = total * (this.MELEE_MULT - 1);
      total += extra; parts.push({ label: 'Melee', amount: extra });
    }
    if (streak >= this.STREAK_START) {
      const extra = Math.min(this.STREAK_BONUS_MAX, (streak - this.STREAK_START + 1) * this.STREAK_BONUS_PER);
      total += extra; parts.push({ label: `Streak x${streak}`, amount: extra });
    }
    if (bounty > 0) {
      total += bounty; parts.push({ label: 'Bounty', amount: bounty });
    }
    return { total: Math.round(total), parts };
  },

  // Multiplayer hooks, not used by wave mode.
  deathPenalty(balance) { return Math.floor(balance * this.DEATH_PENALTY); },
  bounty(victimBalance, allBalances) {
    const leader = Math.max(...allBalances);
    return victimBalance > 0 && victimBalance === leader ? Math.round(victimBalance * this.BOUNTY_SHARE) : 0;
  },
};
