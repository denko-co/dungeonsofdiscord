const Abilities = require('../mechanics/abilities.js');
const Character = require('../mechanics/character.js');
const Util = require('../util/util.js');

// Define all creatures

let creatures = {
  trainingDummy: {
    name: 'Training Dummy',
    description: 'Training, for dummies.',
    hp: 1
  },
  anOldMan: {
    name: 'An Old Man',
    description: 'Wise beyond his... uh, wise for his years.',
    hp: 10,
    speed: 'FAST',
    abilities: [
      Abilities.getAbility('Training Preperation')
    ],
    logic: {
      async performTurn (battleManager, me) {
        await battleManager.send('Here we go! Let\'s summon something!');
        await battleManager.useAbility(me.abilities[0], me, [3]);
      }
    }
  }
};

exports.getCreature = function (name) {
  let creatureDetails = creatures[Util.convertName(name)];
  if (!creatureDetails) {
    throw new Error(`Creature with name ${name} not found!`);
  }
  let creatureToAdd = new Character(creatureDetails.name, creatureDetails.description, 'CREATURE', creatureDetails.hp, creatureDetails.speed, creatureDetails.logic, creatureDetails.abilities, creatureDetails.items, creatureDetails.effects);
  return creatureToAdd;
};
