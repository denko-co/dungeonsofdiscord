const _ = require('underscore');
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

for (let item in items) {
  let itemDetails = items[item];
  items[item] = new Item(itemDetails.name, itemDetails.description, itemDetails.flavour, itemDetails.abilities, itemDetails.effects);
}

exports.getItem = function (name) {
  let itemToAdd = _.clone(items[Util.convertName(name)]);
  if (!itemToAdd) {
    throw new Error(`Item with name ${name} not found!`);
  }
  return itemToAdd;
};
