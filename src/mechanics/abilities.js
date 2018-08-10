const _ = require('underscore');
const Ability = require('./ability.js');
const Effects = require('./effects.js');
const Util = require('../util/util.js');

// Define all abilities
let abilities = {
  chop: {
    name: 'Chop',
    description: 'Deal 3-5 damage to 1 target.',
    flavour: 'Smack that!',
    effect: Effects.getEffect('Flat Damage', {
      getDamage: function () {
        return _.random(3, 5);
      }
    }),
    cooldown: 0,
    targets: 1,
    distance: 1,
    icon: 'knife'
  }
};

for (let ability in abilities) {
  let abilityDetails = abilities[ability];
  abilities[ability] = new Ability(abilityDetails.name, abilityDetails.description, abilityDetails.flavour, abilityDetails.effect, abilityDetails.cooldown, abilityDetails.targets, abilityDetails.distance, abilityDetails.icon);
}

exports.getAbility = function (name) {
  let abilityToAdd = _.clone(abilities[Util.convertName(name)]);
  if (!abilityToAdd) {
    throw new Error(`Ability with name ${name} not found!`);
  }
  return abilityToAdd;
};
