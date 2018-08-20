const Abilities = require('./abilities.js');
const Item = require('./item.js');
const Util = require('../util/util.js');

// Define all items
let items = {
  trainingSword: {
    name: 'Training Sword',
    description: 'A basic sword, weak, but effective. Never misses.',
    flavour: 'Some say that even a simple sword can slice arrows, in the right hands.',
    abilityNames: [
      'Whack'
    ]
  },
  trainingShield: {
    name: 'Training Shield',
    description: 'A basic shield, which negates Training Dummy damage.',
    flavour: 'Who\'s doing the training, you, or the dummy?',
    abilityNames: [
      'Dummy Defense'
    ]
  }
};

exports.getItem = function (name) {
  let itemDetails = items[Util.convertName(name)];
  if (!itemDetails) {
    throw new Error(`Item with name ${name} not found!`);
  }
  let abilities = [];
  if (itemDetails.abilityNames) {
    for (let i = 0; i < itemDetails.abilityNames.length; i++) {
      abilities.push(Abilities.getAbility(itemDetails.abilityNames[i]));
    }
  }
  let itemToAdd = new Item(itemDetails.name, itemDetails.description, itemDetails.flavour, abilities, itemDetails.effects, itemDetails.onUse);
  return itemToAdd;
};
