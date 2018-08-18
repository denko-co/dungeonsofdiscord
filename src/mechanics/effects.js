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
      async onApply (battleManager, caster, target) {
        let dmg = this.getDamage();
        target.dealDamage(this.getDamage());
        await battleManager.send(target.name + ' takes ' + dmg + ' damage!');
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
      async onBattlefieldApply (battleManager, caster, locationsArray) {
        let currentSummon = 0;
        let summonedNames = [];
        for (let i = 0; i < locationsArray.length; i++) {
          battleManager.battlefield[locationsArray[i]].push(Util.clone(this.toSummon[currentSummon]));
          summonedNames.push(this.toSummon[currentSummon].name);
          currentSummon = currentSummon + 1 === this.toSummon.length ? 0 : currentSummon + 1;
        }
        var reducedList = Util.reduceList(summonedNames);
        var s = reducedList.length === 1 ? 's' : '';
        await battleManager.send('A new challenger approaches! ' + Util.capitalise(Util.formattedList(reducedList)) + ' join' + s + ' the fight!');
      }
    }
  },
  stickyFloor: {
    name: 'Sticky Floor',
    description: 'Can\'t move from this position.',
    flavour: 'No retreat!',
    ticks: null,
    properties: {
      onMoveForwardAttempt (char, battleManager) {
        return 0;
      },
      onMoveBackwardAttempt (char, battleManager) {
        return 0;
      }
    }
  },
  noEscape: {
    name: 'No Escape',
    description: 'Can\'t flee from this position.',
    flavour: 'No surrender!',
    ticks: null,
    properties: {
      onFleeAttempt (char, battleManager) {
        return 0;
      }
    }
  }
};

exports.getEffect = function (name, requiredParams) {
  let effectDetails = effects[Util.convertName(name)];
  if (!effectDetails) {
    throw new Error(`Effect with name ${name} not found!`);
  }
  let effectToAdd = new Effect(effectDetails.name, effectDetails.description, effectDetails.flavour, 'ticks' in effectDetails ? effectDetails.ticks : 0, effectDetails.required, effectDetails.properties);

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
