const _ = require('underscore');
const Ability = require('./ability.js');
const Effects = require('./effects.js');
const Creatures = require('../content/creatures.js');
const Util = require('../util/util.js');

// Define all abilities
let abilities = {
  whack: {
    name: 'Whack',
    description: 'Deal 3-5 damage.',
    flavour: 'Smack that!',
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
  trainingPreparation: {
    name: 'Training Preparation',
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
  let abilityToAdd = new Ability(abilityDetails.name, abilityDetails.description, abilityDetails.flavour, abilityDetails.effect, abilityDetails.cooldown, abilityDetails.targets, abilityDetails.range, abilityDetails.icon);
  return abilityToAdd;
};
