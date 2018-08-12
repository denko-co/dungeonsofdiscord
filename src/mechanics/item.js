module.exports = class Item {
  constructor (name, description, flavour, uses, abilities, effects) {
    this.name = name;
    this.description = description;
    this.flavour = flavour;
    this.uses = uses;
    this.currentUses = 0;
    this.abilities = abilities || [];
    this.effects = effects || [];
  }
};
