module.exports = class Character {
  // constructor for characters (players, enemies)
  constructor (name, description, type, hp, speed, logic, abilities, items, effects) {
    this.name = name;
    this.description = description;
    this.type = type;
    this.hp = hp;

    this.speed = speed || 'NORMAL';

    if (logic && !logic['performTurn']) {
      throw new Error('Don\'t supply logic without a performTurn method!');
    }
    this.abilities = abilities || [];
    this.items = items || [];
    this.effects = effects || [];

    this.owner = null;
  }

  dealDamage (amount) {
    this.hp -= amount;
    // Handle death and on damage effects
  }
};