const _ = require('underscore');
const Ability = require('./ability.js');
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
    effect: Effects.getEffect('Anxiety', {}),
    range: 2,
    icon: '😟'
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
  }
};

exports.getAbility = function (name) {
  let abilityDetails = abilities[Util.convertName(name)];
  if (!abilityDetails) {
    throw new Error(`Ability with name ${name} not found!`);
  }
  let abilityToAdd = new Ability(abilityDetails.name, abilityDetails.description, abilityDetails.flavour, abilityDetails.type, abilityDetails.effect, abilityDetails.cooldown, abilityDetails.maxUses, abilityDetails.targets, abilityDetails.range, abilityDetails.icon);
  return abilityToAdd;
};
