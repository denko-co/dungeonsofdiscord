module.exports = class Item {
  constructor (name, description, flavour, abilities, effects) {
    this.name = name;
    this.description = description;
    this.flavour = flavour;
    this.abilities = abilities || [];
    this.effects = effects || [];
  }
};
