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
      onApply (manager, caster, target, ability, item) {
        target.dealDamage(this.getDamage(), caster, manager, ability);
      }
    }
  },
  flatBlock: {
    name: 'Flat Block',
    description: 'Reduces incoming damage by a *flat* amount.',
    flavour: 'Block it very hard!',
    ticks: 1,
    required: {
      baseReduce: 'function'
    },
    properties: {
      onRecieveDamage (dmg, target, source, ability) {
        return this.baseReduce(dmg);
      }
    }
  },
  blessingOfKiki: {
    name: 'Blessing Of Kiki',
    description: 'Literally take no damage.',
    flavour: 'Can\'t touch this!',
    ticks: null,
    properties: {
      damagePings: 0,
      onRecieveDamage (dmg, target, source, ability) {
        this.damagePings++;
        return 0;
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
      onRecieveDamage (dmg, target, source, ability) {
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
      onBattlefieldApply (battleManager, caster, locationsArray, ability, item) {
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
      onApply (manager, caster, target, ability, item) {
        for (let i = 0; i < this.toGive.length; i++) {
          let newItem = Items.getItem(this.toGive[i]);
          newItem.owner = target;
          target.items.push(newItem);
          manager.send(Util.getDisplayName(target) + ' has recieved **' + newItem.displayName + '**: *' + newItem.flavour + '*');
        }
      }
    }
  },
  giveItemForEach: {
    name: 'Give Item For Each',
    description: 'Gives a collection of items to a player for each player in the game. Should resolve immediately.',
    flavour: 'Sharing is caring, and I don\'t care.',
    required: {
      toGive: 'array'
    },
    properties: {
      onApply (manager, caster, target, ability, item) {
        console.log('We in here');
        let gameManager = manager.worldManager ? manager.worldManager.gameManager : manager.gameManager;
        let players = gameManager.playerIds.length;
        let itemsList = [];
        this.toGive.forEach(item => {
          for (let i = 0; i < players; i++) {
            let newItem = Items.getItem(item);
            newItem.owner = target;
            itemsList.push(newItem);
          }
        });
        let stringList = Util.formattedList(Util.reduceList(itemsList.map(item => Util.getDisplayName(item))));
        manager.send(Util.getDisplayName(target) + ' has recieved **' + stringList + '.**');
        target.items.push(...itemsList);
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
        source.heal(3, source, manager, null, ' from Flesh Heal');
        // }
      }
    }
  },
  battleBuff: {
    name: 'Battle Buff',
    description: 'When dealing damage with a range 1 ability, buff it by 20%',
    flavour: 'You\'d think this sort of thing would be defensive...',
    ticks: null,
    properties: {
      onDealDamage (dmg, target, source, ability) {
        return ability.range === 1 ? dmg * 1.2 : dmg;
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
      onApply (manager, caster, target, ability, item) {
        caster.dealDamage(this.getDamage(), caster, manager, ability);
        target.heal(this.getHealing(), caster, manager, ability);
      }
    }
  },
  unboxing: {
    name: 'Unboxing',
    description: 'Opening some sweet loot! Or maybe three commons and a rare.',
    flavour: 'Overwatch meme, not a hearthstone one.',
    ticks: 1,
    properties: {
      /*
      onApply (manager, caster, target, ability, item) {
        this.appliedBy = item;
      },
      */
      onTick (manager, source, target) {
        // Get all the current players, from the manager
        let gameManager = manager.worldManager ? manager.worldManager.gameManager : manager.gameManager;
        let players = Util.getEffectiveCharacters(gameManager.players).players;
        if (players.every(player => player.effects.find(effect => effect.name === 'Unboxing'))) {
          // All players unboxing, give them their loot
          let mapping = {
            'Battle Medic': [
              'Spiked Shield'
            ]
          };
          players.forEach(player => {
            let itemList = mapping[player.name];
            itemList.forEach(item => {
              let newItem = Items.getItem(item);
              newItem.owner = target;
              newItem.equipped = true;
              target.items.push(newItem);
              manager.send(Util.getDisplayName(target) + ' has recieved **' + newItem.displayName + '**: *' + newItem.flavour + '*');
            });
            for (let i = player.effects.length - 1; i >= 0; i--) {
              if (player.effects[i].name === 'Unboxing') {
                player.effects.splice(i, 1);
              }
            };
            for (let i = player.items.length - 1; i >= 0; i--) {
              if (player.items[i].name === 'Loot Box') {
                player.items.splice(i, 1);
              }
            };
          });
        }
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
