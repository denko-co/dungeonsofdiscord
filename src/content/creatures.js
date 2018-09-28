const Abilities = require('./abilities.js');
const Character = require('../mechanics/character.js');
const Util = require('../util/util.js');

// Define all creatures

let creatures = {
  trainingDummy: {
    name: 'Training Dummy',
    description: 'Training, for dummies.',
    hp: 9001,
    speed: 'SLOW',
    abilityNames: [
      'Training Strike'
    ],
    logic: {
      state: {
        hurt: false,
        swung: false,
        killed: false
      },
      performTurn (battleManager) {
        if (this.currenthp === this.hp) {
          battleManager.send('The Dummy gazes at our heroes stoicly, although inside it is deeply troubled. How did he get here? What is his purpose? What is he supposed to do?');
        } else if (!this.logic.state.hurt) {
          this.logic.state.hurt = true;
          battleManager.send('The Dummy has emotional wounds far deeper than its external ones. Has it been brought into this world only to suffer? The force of the strike has knocked them back. They prepare a counter.');
        } else if (!this.logic.state.swung) {
          let playersTargetable = battleManager.battlefield[2]; // This should be a real check someday
          if (playersTargetable.length === 0) {
            // They moved out of range!
            battleManager.send('The Dummy bounces back and swings into the empty air. In the distance, a sad violin plays.');
          } else {
            // Hit it very hard!
            battleManager.send('The Dummy bounces back and swings forward with all of its might.');
            let char = playersTargetable[0];
            battleManager.useAbility(this.abilities[0], this, [char]);
            if (!char.alive) {
              this.logic.state.killed = true;
            }
          }
          this.logic.state.swung = true;
        } else {
          if (this.hasEffect('Anxiety')) { // ;(
            battleManager.send('The Dummy is overcome. It can\'t take it anymore.');
            battleManager.useAbility(this.abilities[0], this, [this]);
          } else {
            battleManager.send('The Dummy rests, ' + (this.logic.state.killed ? 'bloodied from battle.' : 'exhausted and defeated.') + ' What more is there to do?');
          }
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
      'Training Preparation',
      'Drop Party',
      'Drop Party 2'
    ],
    logic: {
      state: {
        undamagedTurns: 0,
        shieldGiven: false
      },
      performTurn (battleManager) {
        let turn = battleManager.turn;
        switch (turn - this.logic.state.undamagedTurns) {
          case 1:
            battleManager.send('"Hello, welcome to the dungeon! Before you run around adventuring, first you\'ve got to learn the ropes!" *ahem*');
            battleManager.useAbility(this.abilities[0], this, [3]);
            battleManager.send('"You wouldn\'t believe how long that took to get working. Alright, now, use your sword to hit this Dummy!"');
            break;
          case 2:
            let dummy = battleManager.battlefield[3][0];
            if (!dummy) {
              // Dummy has died somehow, uh oh
            } else if (dummy.currenthp === dummy.hp) {
              this.logic.state.undamagedTurns++;
              battleManager.send('"C\'mon guys, you gotta do SOMETHING."');
            } else {
              battleManager.send('"Very good!" he exclaims. You can tell he is *very impressed*.');
              battleManager.useAbility(this.abilities[1], this, Util.getEffectiveCharacters(battleManager.battlefield).players);
              battleManager.send('"This shield will protect you from the dummy\'s rage. Try to use it now."');
            }
            break;
          default:
            let fighter = battleManager.battlefield[3][0]; // ;)
            if (!fighter) {
              // Dummy has died somehow, uh oh
            } else {
              if (fighter.logic.state.swung) {
                battleManager.send('"Heh, well then. I have taught you all you need for now. Now to finish this up. Here, catch!"');
                battleManager.useAbility(this.abilities[2], this, Util.getEffectiveCharacters(battleManager.battlefield).players);
                battleManager.send('"Alright, I best be going now. Take care out there!"');
                battleManager.performFlee(this, 1); // This shoud be real at some point also
              } else {
                battleManager.send('"You\'ll notice that if you blocked, you\'re buffed for 1 turn only. That means if you blocked last turn, you\'ll come out of block now."');
                battleManager.send('"I would brace for impact, if I were you." The Old Man winks.');
              }
            }
        }
      }
    }
  }
};

exports.getCreature = function (name, displayName) {
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
  let creatureToAdd = new Character(creatureDetails.name, displayName || creatureDetails.name, creatureDetails.description, 'CREATURE', creatureDetails.hp, creatureDetails.speed, creatureDetails.logic, abilities, creatureDetails.items, creatureDetails.effects);
  creatureToAdd.logic.performTurn = creatureToAdd.logic.performTurn.bind(creatureToAdd);
  return creatureToAdd;
};
