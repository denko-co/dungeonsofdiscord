module.exports = class Ability {
  constructor (name, description, flavour, effect, cooldown, targets, distance, icon) {
    this.name = name;
    this.description = description;
    this.flavour = flavour;
    this.effect = effect;
    this.cooldown = cooldown;
    this.targets = targets;
    this.distance = distance;
    this.icon = icon;
  }
};
