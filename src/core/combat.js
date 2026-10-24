// Damage rules shared by every mode.
CS.Combat = {
  LIMB_MULT: 0.75,          // leg shots
  HELMET_HEAD_REDUCTION: 0.35,

  // zone is 'head', 'torso' or 'legs'.
  gunDamage(def, zone, target, attackerMult = 1) {
    let mult = 1;
    if (zone === 'head') {
      mult = def.headMult; // 2x normally, 3x for the sniper
      if (target.upgrades.helmet) mult *= 1 - this.HELMET_HEAD_REDUCTION;
    } else if (zone === 'legs') {
      mult = this.LIMB_MULT;
    }
    return def.damage * mult * attackerMult;
  },

  explosionDamage(def, distance) {
    if (distance >= def.radius) return 0;
    return def.damage * (1 - 0.7 * distance / def.radius);
  },
};
