const _ = require('underscore');
const Effect = require('./effect.js');
const Util = require('../util/util.js');

// Define all effects
let effects = {
  flatDamage: {
    name: 'Flat Damage',
    description: 'Indicates the target will take a straight hp hit. Should resolve immediately.',
    flavour: 'Hit it very hard!',
    required: {
      getDamage: 'function'
    },
    properties: {
      onApply (target, gamestate) {
        target.dealDamage(this.getDamage());
      }
    }
  }
};

for (let effectId in effects) {
  let effectDetails = effects[effectId];
  effects[effectId] = new Effect(effectDetails.name, effectDetails.description, effectDetails.flavour, effectDetails.ticks || 0, effectDetails.required, effectDetails.properties);
}

exports.getEffect = function (name, requiredParams) {
  let effectToAdd = _.clone(effects[Util.convertName(name)]);
  if (!effectToAdd) {
    throw new Error(`Effect with name ${name} not found!`);
  }
  for (let effectReq in effectToAdd.required) {
    if (!requiredParams[effectReq]) {
      throw new Error(`${effectReq} is missing, and is required!`);
    }
  }

  for (let requiredParam in requiredParams) {
    let param = requiredParams[requiredParam];
    let effectReq = effectToAdd.required[requiredParam];
    if (!effectReq) {
      throw new Error(`owo, what's this? ${requiredParam} is not a required parameter for the effect ${name}!`);
    }
    if (typeof param !== effectReq) { // eslint-disable-line valid-typeof
      throw new Error(`Provided required param is not of correct type, expected ${effectReq}, got ${typeof param}`);
    }

    // Ready to rumble!
    effectToAdd[requiredParam] = param;
  }

  // return2sender
  return effectToAdd;
};
