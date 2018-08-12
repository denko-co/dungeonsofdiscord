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
    abilityNames: [
      'Training Preparation'
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
  // I would love to define abilities as the actual ability obj
  // Unfortunately the circular dependency of creature -> ability -> creature is too complex so
  // now this
  let abilities = [];
  if (creatureDetails.abilityNames) {
    for (let i = 0; i < creatureDetails.abilityNames.length; i++) {
      abilities.push(Abilities.getAbility(creatureDetails.abilityNames[i]));
    }
  }
  let creatureToAdd = new Character(creatureDetails.name, creatureDetails.description, 'CREATURE', creatureDetails.hp, creatureDetails.speed, creatureDetails.logic, abilities, creatureDetails.items, creatureDetails.effects);
  return creatureToAdd;
};
