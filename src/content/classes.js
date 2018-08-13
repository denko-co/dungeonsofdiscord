const Abilities = require('../mechanics/abilities.js');
const Character = require('../mechanics/character.js');
const Items = require('../mechanics/items.js');
const Util = require('../util/util.js');

// Define all classes (instances as players, stored elsewhere...)

let classes = {
  matyr: {
    name: 'Matyr',
    description: 'Get it, they give their life for others?',
    hp: 15,
    itemNames: [
      'Training Sword'
    ]
  }
};

exports.getClass = function (name, playerId) {
  if (!playerId) {
    throw new Error(`Need to specify a player for this class!`);
  }
  let classDetails = classes[Util.convertName(name)];
  if (!classDetails) {
    throw new Error(`Class with name ${name} not found!`);
  }
  // See creatures.js
  let abilities = [];
  if (classDetails.abilityNames) {
    for (let i = 0; i < classDetails.abilityNames.length; i++) {
      abilities.push(Abilities.getAbility(classDetails.abilityNames[i]));
    }
  }

  let items = [];
  if (classDetails.itemNames) {
    for (let i = 0; i < classDetails.itemNames.length; i++) {
      items.push(Items.getItem(classDetails.itemNames[i]));
    }
  }

  let classToAdd = new Character(classDetails.name, classDetails.description, 'PLAYER', classDetails.hp, classDetails.speed, null, abilities, items, classDetails.effects);
  classToAdd.owner = playerId;
  return classToAdd;
};
