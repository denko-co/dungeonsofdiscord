module.exports = class Character {
  // constructor for characters (players, enemies)
  constructor (name, description, type) {
    this.name = name;
    this.description = description;
    this.type = type;

    // Load blanks

    this.owner = null;
    this.items = [];
    this.abilities = [];
    this.effects = [];
  }
};
