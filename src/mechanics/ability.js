module.exports = class Ability {
  constructor (name, description, flavour, type, effect, cooldown, targets, range, icon) {
    this.name = name;
    this.description = description;
    this.flavour = flavour;
    this.type = type;
    this.effect = effect;
    this.cooldown = cooldown;
    this.targets = targets;
    this.range = range;
    this.icon = icon;
  }

  getAbilityDetails () {
    let text = this.icon + ' **' + this.name + '**' + ' ' + this.description + ' ';
    let info = '';
    if (this.cooldown) info += this.cooldown + ' cd';
    if (this.targets) info += (info === '' ? '' : ', ') + this.targets.number + ' target' + (this.targets.number === 1 ? '' : 's');
    if (this.range) info += (info === '' ? '' : ', ') + this.range + ' range';
    return text + ' ' + (info === '' ? '' : '(' + info + ')');
  }
};
