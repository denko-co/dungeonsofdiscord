module.exports = class Ability {
  constructor (name, displayName, description, flavour, type, effect, cooldown, maxUses, targets, range, icon) {
    this.name = name;
    this.displayName = displayName;
    this.description = description;
    this.flavour = flavour;
    this.type = type;
    this.effect = effect;
    this.cooldown = cooldown;
    // Passed in, holds info about max uses overall or in a single battle
    this.maxUses = maxUses;
    // Hold info about ability use for battle
    this.uses = {
      game: 0,
      battle: 0
    };
    this.targets = targets;
    this.range = range;
    this.icon = icon;
  }

  getAbilityDetails () {
    let text = this.icon + ' **' + this.displayName + '**' + ' ' + this.description + ' ';
    let info = '';
    if (this.cooldown) info += this.cooldown + ' cd';
    if (this.maxUses) {
      if (this.maxUses.game) {
        info += (info === '' ? '' : ', ') + this.maxUses.game + ' use' +
        (this.maxUses.game === 1 ? '' : 's') + ', ' + (this.maxUses.game - this.uses.game) + ' remaining';
      }
      if (this.maxUses.battle) {
        info += (info === '' ? '' : ', ') + this.maxUses.battle + ' use' +
        (this.maxUses.battle === 1 ? '' : 's') + ' per battle, ' + (this.maxUses.battle - this.uses.battle) + ' remaining';
      }
    }
    if (this.targets) info += (info === '' ? '' : ', ') + this.targets.number + ' target' + (this.targets.number === 1 ? '' : 's');
    if (this.range) info += (info === '' ? '' : ', ') + this.range + ' range';
    return text + ' ' + (info === '' ? '' : '(' + info + ')');
  }
};
