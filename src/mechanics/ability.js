module.exports = class Ability {
  constructor (name, description, flavour, effect, cooldown, targets, range, icon) {
    this.name = name;
    this.description = description;
    this.flavour = flavour;
    this.effect = effect;
    this.cooldown = cooldown;
    this.targets = targets;
    this.range = range;
    this.icon = icon;
  }
};
