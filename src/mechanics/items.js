const Item = require('./item.js');
const Abilities = require('./abilities.js');
const Util = require('../util/util.js');

// Define all items
let items = {
  trainingSword: {
    name: 'Training Sword',
    description: 'A basic sword, weak, but effective. Never misses.',
    flavour: 'Some say that even a simple weapon can slice arrows, in the right hands.',
    abilities: [
      Abilities.getAbility('Chop')
    ]
  }
};

exports.getItem = function (name) {
  let itemDetails = items[Util.convertName(name)];
  if (!itemDetails) {
    throw new Error(`Item with name ${name} not found!`);
  }
  let itemToAdd = new Item(itemDetails.name, itemDetails.description, itemDetails.flavour, itemDetails.uses, itemDetails.abilities, itemDetails.effects);
  return itemToAdd;
};
