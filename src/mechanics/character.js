const Util = require('../util/util.js');

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

  iterateEffects (abilityType, battleManager, getChance) {
    let currentChance = 1;
    let abilitiesTriggered = [];
    let battleEffects = [];
    if (battleManager) {
      battleEffects = battleManager.battlefieldEffects[battleManager.getCharacterLocation(this).arrayPosition];
    }
    let effectsToCheck = this.item.effects.concat(this.effects).concat(battleEffects);
    let functionName = 'on' + Util.titleCase(abilityType) + (getChance ? 'Attempt' : '');

    effectsToCheck.forEach(itemEffect => {
      if (itemEffect[functionName]) {
        let result = itemEffect[functionName](this, battleManager);
        if (getChance) currentChance *= result;
        abilitiesTriggered.push(itemEffect.name);
      }
    });

    // If not a getChance call then currentChance will be 1, because it already happened, ya feel?
    return {
      abilitiesTriggered: abilitiesTriggered,
      chance: currentChance
    };
  }

  getCharacterDetails (battleManager) {
    let text = '*Current hp:* ';
    text += this.currenthp + '/' + this.hp + '\n';
    text += '*Abilities:* ' + (this.abilities.length === 0 ? '-' : '') + '\n';
    this.abilities.forEach(ability => {
      text += ability.getAbilityDetails() + '\n';
    });
    text += '*Items:* ' + (this.items.length === 0 ? '-' : '') + '\n';
    this.items.forEach(item => {
      text += item.getItemDetails() + '\n';
    });

    return text;
  }
};
