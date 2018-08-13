module.exports = class Character {
  // constructor for characters (players, enemies)
  constructor (name, description, type, hp, speed, logic, abilities, items, effects) {
    this.name = name;
    this.description = description;
    this.type = type;
    this.hp = hp;
    this.currenthp = hp;

    this.speed = speed || 'NORMAL';

    if (logic && !logic['performTurn']) {
      throw new Error('Don\'t supply logic without a performTurn method!');
    }
    this.logic = logic;

    this.abilities = abilities || [];
    this.items = items || [];
    this.effects = effects || [];

    this.owner = null;

    this.alive = true;
  }

  dealDamage (amount) {
    this.currenthp -= amount;
    // Handle death and on damage effects
    if (this.currenthp <= 0) {
      this.alive = false;
    }
  }
};
