const _ = require('underscore');
const Character = require('../mechanics/character.js');
const Util = require('../util/util.js');

// Define all creatures)

let creatures = {
  trainingDummy: {
    name: 'Training Dummy',
    description: 'Training, for dummies.',
    hp: 1
  }
};

for (let creature in creatures) {
  let creatureDetails = creatures[creature];
  creatures[creature] = new Character(creatureDetails.name, creatureDetails.description, 'CREATURE', creatureDetails.hp, creatureDetails.speed, creatureDetails.abilities, creatureDetails.items, creatureDetails.effects);
}

exports.getCreature = function (name) {
  let classToAdd = _.clone(creatures[Util.convertName(name)]);
  if (!classToAdd) {
    throw new Error(`Creature with name ${name} not found!`);
  }
  return classToAdd;
};
