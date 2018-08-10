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
      onApply (battleManager, target) {
        target.dealDamage(this.getDamage());
      }
    }
  },
  summon: {
    name: 'Summon',
    description: 'Battlefield effect to create a creature at specific location(s). Should resolve immediately.',
    flavour: 'Special summon? Synchro summon? Who knows!',
    required: {
      toSummon: 'array'
    },
    properties: {
      onBattlefieldApply (battleManager, locationsArray) {
        let currentSummon = 0;
        let summonedNames = [];
        for (let i = 0; i < locationsArray; i++) {
          let arrayRef = locationsArray[i][0] === 'ENEMY' ? battleManager.enemies : battleManager.players;
          arrayRef.push(this.toSummon[currentSummon]);
          summonedNames.push(this.toSummon[currentSummon].name);
          currentSummon = currentSummon + 1 === this.toSummon.length ? 0 : currentSummon + 1;
        }
        var reducedList = Util.reduceList(summonedNames);
        var s = reducedList.length >= 1 ? '' : 's';
        battleManager.send('A new challenger approaches!' + Util.capitalise(Util.formattedList(reducedList)) + 'join' + s + 'the fight!');
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
    if (effectReq === 'array') {
      if (!Array.isArray(param)) {
        throw new Error(`Provided required param ${requiredParam} should be array, but isn't`);
      }
    } else if (typeof param !== effectReq) { // eslint-disable-line valid-typeof
      throw new Error(`Provided required param ${requiredParam} is not of correct type, expected ${effectReq}, got ${typeof param}`);
    }

    // Ready to rumble!
    effectToAdd[requiredParam] = param;
  }

  // return2sender
  return effectToAdd;
};
