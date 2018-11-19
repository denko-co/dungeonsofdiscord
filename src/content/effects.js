const Effect = require('../mechanics/effect.js');
const Creatures = require('./creatures.js');
const Items = require('./items.js');
const Util = require('../util/util.js');

// Define all effects
let effects = {
  flatDamage: {
    name: 'Flat Damage',
    description: 'Indicates the target will take a straight hp hit. Should resolve immediately.',
    flavour: 'Hit it very hard!',
    required: {
      getDamage: 'function'
    },
    properties: {
      onApply (manager, caster, target, ability) {
        target.dealDamage(this.getDamage(), caster, manager);
      }
    }
  },
  selectiveBlock: {
    name: 'Selective Block',
    description: 'Reducing incoming damage, more for some enemies.',
    flavour: 'I guess "selective" is one way of putting it.',
    ticks: 1,
    required: {
      baseReduce: 'function',
      creatures: 'array'
    },
    properties: {
      onRecieveDamage (dmg, target, source) {
        // Use real name to correctly identify type
        return this.creatures.includes(source.name) ? 0 : this.baseReduce(dmg);
      }
    }
  },
  anxiety: {
    name: 'Anxiety',
    description: 'Truly the worst weapon. Just a filler for applying a status, should make more generic.',
    flavour: 'Shake and rattle, no roll.',
    ticks: Infinity,
    required: {},
    properties: {}
  },
  summon: {
    name: 'Summon',
    description: 'Battlefield effect to create a creature at specific location(s). Should resolve immediately.',
    flavour: 'Special summon? Synchro summon? Who knows!',
    required: {
      toSummon: 'array'
    },
    properties: {
      onBattlefieldApply (battleManager, caster, locationsArray, ability) {
        let currentSummon = 0;
        let summonedNames = [];
        for (let i = 0; i < locationsArray.length; i++) {
          let monsterToSummon = Creatures.getCreature(this.toSummon[currentSummon]);
          battleManager.battlefield[locationsArray[i]].push(monsterToSummon);
          summonedNames.push(monsterToSummon.displayName);
          currentSummon = currentSummon + 1 === this.toSummon.length ? 0 : currentSummon + 1;
        }
        var reducedList = Util.reduceList(summonedNames);
        var s = reducedList.length === 1 ? 's' : '';
        battleManager.send('A new challenger approaches! ' + Util.capitalise(Util.formattedList(reducedList)) + ' join' + s + ' the fight!');
      }
    }
  },
  giveItem: {
    name: 'Give Item',
    description: 'Gives a collection of items to a player. Should resolve immediately.',
    flavour: 'When life gives you lemons.',
    required: {
      toGive: 'array'
    },
    properties: {
      onApply (manager, caster, target, ability) {
        for (let i = 0; i < this.toGive.length; i++) {
          let newItem = Items.getItem(this.toGive[i]);
          newItem.owner = target;
          target.items.push(newItem);
          manager.send(Util.getDisplayName(target) + ' has recieved **' + newItem.displayName + '**: *' + newItem.flavour + '*');
        }
      }
    }
  },
  cautiousCliffside: {
    name: 'Cautious Cliffside',
    description: 'Can\'t move forward from this position.',
    flavour: 'The grass is always greener on the other side.',
    ticks: null,
    properties: {
      onMoveForwardAttempt (char, manager) {
        return 0;
      }
    }
  },
  noEscape: {
    name: 'No Escape',
    description: 'Can\'t flee from this position.',
    flavour: 'No surrender!',
    ticks: null,
    properties: {
      onFleeAttempt (char, manager) {
        return 0;
      }
    }
  },
  fleshHeal: {
    name: 'Flesh Heal',
    description: 'At the end of your turn, if damaged, heal self for 3 health.',
    flavour: 'Chocolate!',
    ticks: null,
    properties: {
      onTick (manager, source, target) {
        // if (source.currenthp !== source.hp) {
        source.heal(3, source, manager, ' from Flesh Heal');
        // }
      }
    }
  },
  siphonHealth: {
    name: 'Siphon Health',
    description: 'Deal damage to a source while healing targets.',
    flavour: 'Cookies and Cream ;)',
    ticks: null,
    required: {
      getDamage: 'function',
      getHealing: 'function'
    },
    properties: {
      onApply (manager, caster, target, ability) {
        caster.dealDamage(this.getDamage(), caster, manager);
        target.heal(this.getHealing(), caster, manager);
      }
    }
  }
};

exports.getEffect = function (name, requiredParams, displayName) {
  let effectDetails = effects[Util.convertName(name)];
  if (!effectDetails) {
    throw new Error(`Effect with name ${name} not found!`);
  }
  let effectToAdd = new Effect(effectDetails.name, displayName || effectDetails.name, effectDetails.description, effectDetails.flavour, 'ticks' in effectDetails ? effectDetails.ticks : 0, effectDetails.required, effectDetails.properties);

  Util.verifyRequired(effectToAdd.required, requiredParams, effectToAdd);

  // return2sender
  return effectToAdd;
};
