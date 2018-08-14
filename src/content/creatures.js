const Abilities = require('../mechanics/abilities.js');
const Character = require('../mechanics/character.js');
const Util = require('../util/util.js');

// Define all creatures

let creatures = {
  trainingDummy: {
    name: 'Training Dummy',
    description: 'Training, for dummies.',
    hp: 9001,
    speed: 'SLOW',
    logic: {
      hurt: false,
      async performTurn (battleManager, me) {
        if (me.currenthp === me.hp) {
          await battleManager.send('The Dummy gazes at our heroes stoicly, although inside it is deeply troubled. How did he get here? What is his purpose? What is he supposed to do?');
        } else if (!me.logic.hurt) {
          me.logic.hurt = true;
          await battleManager.send('The Dummy has emotional wounds far deeper than its external ones. Has it been brought into this world only to suffer? The force of the strike has knocked them back. They prepare a counter.');
        }
      }
    }
  },
  oldMan: {
    name: 'Old Man',
    description: 'Wise beyond his... uh, wise for his years.',
    hp: 10,
    speed: 'FAST',
    abilityNames: [
      'Training Preparation'
    ],
    logic: {
      undamagedTurns: 0,
      async performTurn (battleManager, me) {
        let turn = battleManager.turn;
        switch (turn - me.logic.undamagedTurns) {
          case 1:
            await battleManager.send('"Hello, welcome to the dungeon! Before you run around adventuring, first you\'ve got to learn the ropes!" *ahem*');
            await battleManager.useAbility(me.abilities[0], me, [3]);
            await battleManager.send('"You wouldn\'t believe how long that took to get working. Alright, now, use your sword to hit this Dummy!"');
            break;
          case 2:
            let dummy = battleManager.battlefield[3][0];
            if (!dummy) {
              // Dummy has died somehow, uh oh
            } else if (dummy.currenthp === dummy.hp) {
              me.logic.undamagedTurns++;
              await battleManager.send('"C\'mon guys, you gotta do SOMETHING."');
            } else {
              await battleManager.send('"Very good!" he exclaims. You can tell he is *very impressed*.');
            }
        }
      }
    }
  }
};

exports.getCreature = function (name) {
  let creatureDetails = creatures[Util.convertName(name)];
  if (!creatureDetails) {
    throw new Error(`Creature with name ${name} not found!`);
  }
  // I would love to define abilities as the actual ability obj
  // Unfortunately the circular dependency of creature -> ability -> creature is too complex so
  // now this
  let abilities = [];
  if (creatureDetails.abilityNames) {
    for (let i = 0; i < creatureDetails.abilityNames.length; i++) {
      abilities.push(Abilities.getAbility(creatureDetails.abilityNames[i]));
    }
  }
  let creatureToAdd = new Character(creatureDetails.name, creatureDetails.description, 'CREATURE', creatureDetails.hp, creatureDetails.speed, creatureDetails.logic, abilities, creatureDetails.items, creatureDetails.effects);
  return creatureToAdd;
};
