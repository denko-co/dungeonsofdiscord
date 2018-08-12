const Character = require('../mechanics/character.js');
const Items = require('../mechanics/items.js');
const Util = require('../util/util.js');

// Define all classes (instances as players, stored elsewhere...)

let classes = {
  matyr: {
    name: 'Matyr',
    description: 'Get it, they give their life for others?',
    hp: 15,
    items: [
      Items.getItem('Training Sword')
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
  let classToAdd = new Character(classDetails.name, classDetails.description, 'PLAYER', classDetails.hp, classDetails.speed, classDetails.abilities, classDetails.items, classDetails.effects);
  classToAdd.owner = playerId;
  return classToAdd;
};
