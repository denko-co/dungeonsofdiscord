const _ = require('underscore');
const Ability = require('../mechanics/ability.js');
const Effects = require('./effects.js');
const Util = require('../util/util.js');

// Define all abilities
let abilities = {
  // These are special abilities for all players in battle (assuming they can)
  pass: {
    name: 'Pass',
    description: 'Special ability for passing turn',
    type: ['PASS'],
    icon: '🤷'
  },
  flee: {
    name: 'Flee',
    description: 'Special ability for running away',
    type: ['FLEE'],
    icon: '🏳'
  },
  move: {
    name: 'Move',
    description: 'Special ability for changing positions',
    type: ['MOVE_FORWARD', 'MOVE_BACKWARD'],
    icon: '↔'
  },
  return: {
    name: 'Return',
    description: 'Special ability for going back to the world manager context',
    type: ['RETURN'],
    icon: '⬅'
  },
  equip: {
    name: 'Equip',
    description: 'Special ability for swapping items in your inventory',
    type: ['EQUIP'],
    icon: '🔄'
  },
  give: {
    name: 'Give',
    description: 'Special ability for giving an item',
    type: ['GIVE'],
    icon: '🎁',
    targets: {
      number: 1,
      type: 'ALLY'
    },
    range: 1
  },
  battle: {
    name: 'Battle',
    description: 'Special ability for printing the field state',
    type: ['BATTLE'],
    icon: '📰'
  },
  info: {
    name: 'Info',
    description: 'Special ability for telling you what all the buttons do',
    type: ['INFO'],
    icon: 'ℹ'
  },
  // Player abilities
  whack: {
    name: 'Whack',
    description: 'Deal 3-5 damage.',
    flavour: 'Smack that!',
    type: ['DAMAGE'],
    effect: Effects.getEffect('Flat Damage', {
      getDamage: function () {
        return _.random(3, 5);
      }
    }),
    cooldown: 0,
    targets: {
      number: 1,
      type: 'ENEMY'
    },
    range: 1,
    icon: '⚔'
  },
  block: {
    name: 'Block',
    description: 'Reduce incoming damage by 5-7 points.',
    flavour: 'Where does the variance come from?',
    type: ['BLOCK'],
    targets: {
      number: 1,
      type: 'SELF'
    },
    effect: Effects.getEffect('Flat Block', {
      baseReduce: function (damage) {
        return damage - _.random(3, 5);
      }
    }),
    range: 0,
    icon: '⚙'
  },
  dummyDefense: {
    name: 'Dummy Defense',
    description: 'Reduce incoming damage by 1 this turn. If it\'s a Training Dummy, negate all of it.',
    flavour: 'Smack that!',
    type: ['BLOCK'],
    targets: {
      number: 1,
      type: 'SELF'
    },
    effect: Effects.getEffect('Selective Block', {
      baseReduce: function (damage) {
        return damage - 1;
      },
      creatures: ['Training Dummy']
    }),
    range: 0,
    icon: '🛡'
  },
  makeWorried: {
    name: 'Make Worried',
    description: 'How do you fell a goliath?',
    flavour: 'Sounds like the setup to a poor joke.',
    type: ['STATUS'],
    targets: {
      number: 1,
      type: 'ENEMY'
    },
    maxUses: {
      game: 1
    },
    effect: Effects.getEffect('Anxiety', {}),
    range: 2,
    icon: '😰'
  },
  popTheLocks: {
    name: 'Pop The Locks',
    description: 'Open the box. Or at least, try to.',
    type: ['GIVE_ITEM'],
    effect: Effects.getEffect('Unboxing', {}),
    targets: {
      number: 1,
      type: 'SELF'
    },
    range: 0,
    icon: '📤'
  },
  // Creature abilities
  trainingPreparation: {
    name: 'Training Preparation',
    type: ['SUMMON'],
    effect: Effects.getEffect('Summon', {
      toSummon: ['Training Dummy']
    }),
    targets: {
      number: 0
    }
  },
  blessedSummon: {
    name: 'Blessed Summon',
    type: ['SUMMON'],
    effect: Effects.getEffect('Summon', {
      toSummon: ['Blessed Training Dummy']
    }),
    targets: {
      number: 0
    }
  },
  dropParty: {
    name: 'Drop Party',
    type: ['GIVE_ITEM'],
    effect: Effects.getEffect('Give Item', {
      toGive: ['Training Shield']
    }),
    targets: {
      number: Infinity
    }
  },
  dropParty2: {
    name: 'Drop Party 2',
    type: ['GIVE_ITEM'],
    effect: Effects.getEffect('Give Item', {
      toGive: ['Bottled Anxiety']
    }),
    targets: {
      number: Infinity
    }
  },
  enjoyYourLoot: {
    name: 'Enjoy Your Loot',
    type: ['GIVE_ITEM'],
    effect: Effects.getEffect('Give Item For Each', {
      toGive: ['Loot Box']
    }),
    targets: {
      number: 1
    }
  },
  trainingStrike: {
    name: 'Training Strike',
    type: ['DAMAGE'],
    effect: Effects.getEffect('Flat Damage', {
      getDamage: function () {
        return 1748955718;
      }
    }),
    targets: {
      number: 1
    },
    range: 1
  },
  healingHands: {
    name: 'Healing Hands',
    description: 'Take 2 damage and heal a character for 4 health.',
    type: ['HEAL', 'DAMAGE'],
    icon: '🙌',
    effect: Effects.getEffect('Siphon Health', {
      getDamage: function () {
        return 2;
      },
      getHealing: function () {
        return 4;
      }
    }),
    targets: {
      number: 1
    },
    range: 2
  },
  snipe: {
    name: 'Snipe',
    description: 'Deal 4-6 damage to a target.',
    type: ['DAMAGE'],
    icon: '🎯',
    effect: Effects.getEffect('Flat Damage', {
      getDamage: function () {
        return _.random(4, 6);
      }
    }),
    targets: {
      number: 1,
      type: 'ALLY'
    },
    range: 6
  },
  stabilise: {
    name: 'Stabilise',
    description: 'Heal a friendly character for 2 health, with 50% chance to cure each damaging effect on a character.',
    type: ['HEAL'],
    icon: '⚖',
    effect: Effects.getEffect('Heal And Cure', {
      getHealing: function () {
        return 2;
      },
      doesCure: function () {
        return Math.random() > 0.5;
      }
    }),
    targets: {
      number: 1,
      type: 'ALLY'
    },
    range: 6
  }
};

exports.getAbility = function (name, displayName) {
  let abilityDetails = abilities[Util.convertName(name)];
  if (!abilityDetails) {
    throw new Error(`Ability with name ${name} not found!`);
  }
  let abilityToAdd = new Ability(abilityDetails.name, displayName || abilityDetails.name, abilityDetails.description, abilityDetails.flavour, abilityDetails.type, abilityDetails.effect, abilityDetails.cooldown, abilityDetails.maxUses, abilityDetails.targets, abilityDetails.range, abilityDetails.icon);
  return abilityToAdd;
};
