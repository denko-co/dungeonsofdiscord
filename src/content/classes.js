const _ = require('underscore');
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

for (let chars in classes) {
  let classDetails = classes[chars];
  classes[chars] = new Character(classDetails.name, classDetails.description, 'PLAYER', classDetails.hp, classDetails.speed, classDetails.abilities, classDetails.items, classDetails.effects);
}

exports.getClass = function (name, playerId) {
  if (!playerId) {
    throw new Error(`Need to specify a player for this class!`);
  }
  let classToAdd = _.clone(classes[Util.convertName(name)]);
  if (!classToAdd) {
    throw new Error(`Class with name ${name} not found!`);
  }
  classToAdd.owner = playerId;
  return classToAdd;
};
