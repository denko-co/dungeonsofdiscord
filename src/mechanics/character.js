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

  async dealDamage (amount, source, battleManager) {
    let damageReducers = this.getListeningEffects(battleManager, 'onRecieveDamage');
    let reducedDamage = amount;
    for (let i = 0; i < damageReducers.length; i++) {
      // I would use a reducer here but it's async, need to figure out the pattern for this
      let newDamage = await damageReducers[i].onRecieveDamage(reducedDamage, this, source);
      reducedDamage = newDamage < 0 ? 0 : newDamage;
    }
    if (battleManager) {
      // Do this through gamemanager later
      if (reducedDamage !== amount) {
        battleManager.send('However, ' + Util.formattedList(damageReducers.map(ele => ele.name)) + ' ' +
            (damageReducers.length === 1 ? 'has ' : 'have ') + 'reduced this to ' + reducedDamage + '.');
      }
    }
    this.currenthp -= reducedDamage;
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
      let toRemove = await this.processEffect(this.effects[i], character, battleManager);
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

  getAllEffects (battleManager) {
    let battleEffects = [];
    let itemEffects = [];
    if (battleManager) {
      battleEffects = battleManager.battlefieldEffects[battleManager.getCharacterLocation(this).arrayPosition];
    }
    this.items.forEach(item => {
      itemEffects = itemEffects.concat(item.effects);
    });
    return itemEffects.concat(this.effects).concat(battleEffects);
  }

  getListeningEffects (battleManager, functionName) {
    return this.getAllEffects(battleManager).filter(effect => effect[functionName]);
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
