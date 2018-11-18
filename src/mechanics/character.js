const Util = require('../util/util.js');

module.exports = class Character {
  // constructor for characters (players, enemies)
  constructor (name, displayName, description, type, hp, speed, logic, abilities, items, effects) {
    this.name = name;
    this.displayName = displayName;
    this.description = description;
    this.type = type;
    this.hp = hp;
    this.currenthp = hp;

    this.speed = speed || 'NORMAL';

    // Logic typically has the following:
    // Some state stored in state
    // Some turn logic in performTurn()
    // Some conversation tree in onTalk()
    // If you can use items, a list called interactionItems with names, and onInteract()
    // Some description of the person in onInspect()
    this.logic = Util.clone(logic);

    for (let logicEle in this.logic) {
      if (typeof this.logic[logicEle] === 'function') {
        this.logic[logicEle] = this.logic[logicEle].bind(this);
      }
    }

    this.abilities = abilities || [];
    this.items = items || [];
    this.effects = effects || [];

    this.controller = null;

    this.alive = true;
  }

  changeHp (amount, battleManager, modifiers, modifiedAmount) {
    if (battleManager) {
      // Do this through worldmanager later
      if (modifiedAmount !== amount) {
        battleManager.send('However, ' + Util.formattedList(modifiers.map(ele => ele.displayName)) + ' ' +
            (modifiers.length === 1 ? 'has' : 'have') + ' modified this to ' + Math.abs(modifiedAmount) + '.');
      }
    }
    this.currenthp += modifiedAmount;
  }

  dealDamage (amount, source, battleManager, reason) {
    battleManager.send(Util.getDisplayName(this) + ' takes ' + amount + ' damage!');
    let damageModifiers = this.getListeningEffects(battleManager, 'onRecieveDamage');
    let modifiedDamage = damageModifiers.reduce((currentDamage, ele) => {
      let newDamage = ele.onRecieveDamage(currentDamage, this, source);
      return newDamage < 0 ? 0 : newDamage;
    }, amount);
    this.changeHp(-amount, battleManager, damageModifiers, -modifiedDamage);
    // Handle death and on damage effects
    if (this.currenthp <= 0) {
      this.alive = false;
    }
  }

  heal (amount, source, battleManager, reason) {
    amount = amount + this.currenthp > this.hp ? this.hp - this.currenthp : amount;
    battleManager.send(Util.getDisplayName(this) + ' is healed for ' + amount + ' health!');
    let healingModifiers = this.getListeningEffects(battleManager, 'onReceiveHealing');
    let modifiedHealing = healingModifiers.reduce((currentHealing, ele) => {
      let newHealing = ele.onReceiveHealing(currentHealing, this, source);
      return newHealing + this.currenthp > this.hp ? this.hp - this.currenthp : newHealing;
    }, amount);
    this.changeHp(amount, battleManager, healingModifiers, modifiedHealing);
    return modifiedHealing;
  }

  cleanupEffect (character, battleManager) {
    for (let i = 0; i < this.items.length; i++) {
      let item = this.items[i];
      for (let j = item.effects.length - 1; j >= 0; j--) {
        let toRemove = this.processEffect(item.effects[j], character, battleManager);
        if (toRemove) {
          item.effects.splice(j, 1);
        }
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      // Same again
      let toRemove = this.processEffect(this.effects[i], character, battleManager);
      if (toRemove) {
        this.effects.splice(i, 1);
      }
    }
  }

  processEffect (effect, character, battleManager) {
    if (effect.whoApplied === character) {
      if (effect.ticks === effect.currentTicks) {
        // Expire the effect
        if (effect.onRemove) {
          effect.onRemove(battleManager, character, this);
        }
        return true;
      } else {
        if (effect.onTick) {
          effect.onTick(battleManager, character, this);
        }
        effect.currentTicks++;
      }
    }
    return false;
  }

  hasEffect (effectName, battleManager) {
    let effects = this.getAllEffects(battleManager);
    for (let i = 0; i < effects.length; i++) {
      // Use real name to correctly identify effect
      if (effects[i].name === effectName) return true;
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
    let text = '*Details for ' + Util.getDisplayName(this) + '* ';
    text += (this.alive ? '(' + this.currenthp + '/' + this.hp + ' hp)' : '(dead ;~;)') + '\n';
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
