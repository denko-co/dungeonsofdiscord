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

  dealDamage (amount, source, battleManager) {
    let damageReducers = this.getListeningEffects(battleManager, 'onRecieveDamage');
    let newAmount = damageReducers.reduce((currentDamage, ele) => {
      let newDamage = ele.onRecieveDamage(currentDamage, this, source);
      return newDamage < 0 ? 0 : newDamage;
    }, amount);
    this.currenthp -= newAmount;
    // Handle death and on damage effects
    if (this.currenthp <= 0) {
      this.alive = false;
    }
  }

  async cleanupEffect (character, battleManager) {
    for (let i = 0; i < this.items.length; i++) {
      let item = this.items[i];
      for (let j = item.effects.length - 1; j >= 0; j--) {
        let toRemove = await this.processEffect(item.effects[j], character, battleManager);
        if (toRemove) {
          item.effects.splice(j, 1);
        }
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      // Same again
      let toRemove = await this.processEffect(this.effects[0], character, battleManager);
      if (toRemove) {
        this.effects.splice(i, 1);
      }
    }
  }

  async processEffect (effect, character, battleManager) {
    if (effect.whoApplied === character) {
      if (effect.ticks === effect.currentTicks) {
        // Expire the effect
        if (effect.onRemove) {
          await effect.onRemove(battleManager, character, this);
        }
        return true;
      } else {
        if (effect.onTick) {
          await effect.onTick(battleManager, character, this);
        }
        effect.currentTicks++;
      }
    }
    return false;
  }

  getListeningEffects (battleManager, functionName) {
    let effects = [];
    let battleEffects = [];
    let itemEffects = [];
    if (battleManager) {
      battleEffects = battleManager.battlefieldEffects[battleManager.getCharacterLocation(this).arrayPosition];
    }
    this.items.forEach(item => {
      itemEffects = itemEffects.concat(item.effects);
    });
    let effectsToCheck = itemEffects.concat(this.effects).concat(battleEffects);
    for (let i = 0; i < effectsToCheck.length; i++) {
      let effect = effectsToCheck[i];
      if (effect[functionName]) {
        effects.push(effect.name);
      }
    }

    return effects;
  }

  getCharacterDetails (battleManager) {
    let text = '*Details for ' + Util.getDisplayName(this) + '* (' + this.currenthp + '/' + this.hp + ' hp)\n';
    text += '*Abilities:* ' + (this.abilities.length === 0 ? '-' : '') + '\n';
    this.abilities.forEach(ability => {
      text += ability.getAbilityDetails() + '\n';
    });
    text += '*Items:* ' + (this.items.length === 0 ? '-' : '') + '\n';
    this.items.forEach(item => {
      text += item.getItemDetails() + '\n';
    });
    text += '*Character Effects:* ' + (this.effects.length === 0 ? '-' : '') + '\n';
    this.effects.forEach(effect => {
      text += effect.getEffectDetails() + '\n';
    });
    if (battleManager) {
      let location = battleManager.getCharacterLocation(this);
      if (location) {
        let battleEffects = battleManager.battlefieldEffects[location.arrayPosition];
        text += '*Battlefield Effects:* ' + (battleEffects.length === 0 ? '-' : '') + '\n';
        battleEffects.forEach(bfEffect => {
          text += bfEffect.getEffectDetails() + '\n';
        });
      }
    }

    return text;
  }
};
