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
