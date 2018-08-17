const _ = require('underscore');
const Ability = require('./ability.js');
const Effects = require('./effects.js');
const Creatures = require('../content/creatures.js');
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
    icon: '🏳️'
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
  // Creature abilities
  trainingPreparation: {
    name: 'Training Preparation',
    type: ['SUMMON'],
    effect: Effects.getEffect('Summon', {
      toSummon: [Creatures.getCreature('Training Dummy')]
    }),
    targets: {
      number: 0
    }
  }
};

exports.getAbility = function (name) {
  let abilityDetails = abilities[Util.convertName(name)];
  if (!abilityDetails) {
    throw new Error(`Ability with name ${name} not found!`);
  }
  let abilityToAdd = new Ability(abilityDetails.name, abilityDetails.description, abilityDetails.flavour, abilityDetails.type, abilityDetails.effect, abilityDetails.cooldown, abilityDetails.targets, abilityDetails.range, abilityDetails.icon);
  return abilityToAdd;
};
