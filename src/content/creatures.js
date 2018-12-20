const Abilities = require('./abilities.js');
const Items = require('./items.js');
const Effects = require('./effects.js');
const Character = require('../mechanics/character.js');
const Util = require('../util/util.js');

// Define all creatures

let creatures = {
  blessedTrainingDummy: {
    name: 'Blessed Training Dummy',
    description: 'Undercover Glass Cannon',
    hp: 1,
    speed: 'SLOW',
    effects: [
      'Blessing Of Kiki'
    ],
    logic: {
      state: {
        turn: 0,
        inTutorial: true
      },
      talkState: 'start',
      onTalk: {
        start: {
          userText: null,
          responseText (worldManager) {
            return '...';
          },
          result: { type: 'BATTLE_START', info: {encounterName: 'blessedTesting', nextState: 'itsOva'}}
          // result: { type: 'OPTIONS', info: {options: ['who', 'why', 'buy', 'open', 'open2', 'open3']}}
        }
      },
      performTurn (battleManager) {
        let turn = this.logic.state.turn;
        switch (turn) {
          case 0:
            battleManager.send('The Dummy gazes at our heroes stoicly, although inside it is deeply troubled. How did he get here? What is his purpose? What is he supposed to do?');
            break;
          default:
            battleManager.send('The Dummy passes their turn. What did you expect?');
        }
        turn++;
      }
    }
  },
  testDeath: {
    name: 'Test Death',
    description: 'Commits subaru.',
    hp: 1,
    speed: 'FAST',
    abilityNames: [
      'Training Strike'
    ],
    itemNames: [
      'Sudoku Booklet',
      'Sudoku Booklet',
      'Sudoku Booklet'
    ],
    logic: {
      talkState: 'start',
      performTurn (battleManager) {
        battleManager.useAbility(this.abilities[0], this, [this]);
      },
      onTalk: {
        start: {
          userText: null,
          responseText (worldManager) {
            return '...';
          },
          result: { type: 'BATTLE_START', info: {encounterName: 'Sample Death', nextState: 'end'}}
          // result: { type: 'OPTIONS', info: {options: ['who', 'why', 'buy', 'open', 'open2', 'open3']}}
        },
        end: {
          userText: null,
          responseText (worldManager) {
            console.log(this);
            return '...!';
          },
          result: { type: 'TALK_OVER', info: {newState: 'start'} }
        }
      }
    }
  },
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
          if (this.getEffect('Anxiety', battleManager)) { // ;(
            battleManager.send('The Dummy is overcome. It can\'t take it anymore.');
            battleManager.useAbility(this.abilities[0], this, [this]);
          } else {
            battleManager.send('The Dummy rests, ' + (this.logic.state.killed ? 'bloodied from battle.' : 'exhausted and defeated.') + ' What more is there to do?');
          }
        }
      }
    }
  },
  kiki: {
    name: 'Kiki',
    description: 'Old Man at heart.',
    hp: 10,
    speed: 'FAST',
    effects: [
      'Blessing Of Kiki'
    ],
    abilityNames: [
      'Enjoy Your Loot',
      'Blessed Summon'
    ],
    logic: {
      state: {
        declinedFight: 0,
        askedBuyNoMoney: 0,
        who: false,
        why: false,
        pay: false,
        fightCompleted: false,
        order: 0,
        battleState: 'start',
        noGrab: 0
      },
      talkState: 'start',
      performTurn (battleManager) {
        // battleManager.send('I have taken ' + this.getEffect('Blessing Of Kiki', battleManager).damagePings + ' damages.');
        let state = this.logic.state;
        let players = Util.getEffectiveCharacters(battleManager.battlefield).players;
        switch (state.battleState) {
          case 'start':
            battleManager.send('"Alright, so, first things first, you want some items, yeah? Well, you\'re going to have to get in range so I can pass them to you."');
            battleManager.send('"Use the ↔ button to move. One position away should do the trick. To see where everything is in relation to each other, use your eyes."');
            battleManager.send('"If that\'s not working, press 📰 for an overview."');
            state.battleState = 'move';
            break;
          case 'move':
            let targets = battleManager.battlefield[3];
            if (targets.length > 0) {
              // Give them the loot
              battleManager.send('"Nice, alright. Here, take this. It\'s on the house."');
              console.log(targets);
              battleManager.useAbility(this.abilities[0], this, [targets[0]]);
              if (players.length === 1) {
                battleManager.send('"This is usually the part of the spiel where you learn to use give (🎁). However, it looks like you don\'t have any friends! I mean, down here. Maybe at all, I don\'t know."');
                battleManager.send('"I guess we\'re going to have to skip a little ahead then huh? To get your loot, first you need to equip it with 🔄. Best of all, no friends required! Haha."');
                state.battleState = 'equip';
              } else {

              }
            } else {
              switch (state.noGrab) {
                case 0:
                  break;
                case 1:
                  break;
                case 2:
                  break;
                default:
                  break;
              }
              state.noGrab++;
            }
            break;
          case 'equip':
            for (let i = 0; i < players.length; i++) {
              if (!players[i].items.some(item => item.equipped && item.name === 'Loot Box')) {
                break;
              }
            }
            // Everyone has a loot box equipped.
            battleManager.send('"Good work. Alright, now, open it up! Equipped items have an icon in your action bar (like 📥). Also, do you know how hard it is to say an emoji out loud?"');
            state.battleState = 'pop';
            break;
          case 'pop':
            if (players.every(player => !player.items.some(item => item.name === 'Loot Box'))) {
              // Nobody has a lootbox, spawn the dummy.
              battleManager.send('"Well done! I knew you\'d get it. Eventually. Alright, now, you probably wanna try out your fancy new items, huh?"');
              battleManager.useAbility(this.abilities[1], this, [4]);
              battleManager.send('"You wouldn\'t believe how long that took to get working. Alright, now, use your items to hit this Dummy!"');
              state.battleState = 'dummy';
            }
            break;
          case 'dummy':
            let dummy = battleManager.battlefield[4].find(char => char.name === 'Blessed Training Dummy');
            let blessing = dummy.effects.find(effect => effect.name === 'Blessing Of Kiki');
            if (blessing.damagePings === 0) {
              battleManager.send('"Not hit!"');
            } else {
              // Move the dummy to the real world.
              battleManager.send('"Wow, you sure showed him. Alright, I\'m convinced. Let me just put this somewhere safe..."');
              battleManager.send('Kiki waves her hands, like she was playing charades and the word is very diffuclt. The Dummy begins to disappear.');
              battleManager.send('The Dummy, of course, is incapable of responding, but would say something like "I don\'t feel so good."');
              battleManager.worldManager.currentRoom.entities.push(dummy);
              battleManager.performFlee(dummy, 1); // This shoud be real at some point also
              battleManager.performFlee(this, 1);
            }
            break;
        }
      },
      onTalk: {
        start: {
          userText: null,
          responseText (worldManager) {
            return this.logic.state.declinedFight === 0 ? '"Oh, hey! I see you just came in on the cart - bet you\'re glad you didn\'t end up in Skyrim, huh? ' +
              'Anyway, nice to meet you. I\'m Kiki, I own this camp, shop, and everything else in this room. ' +
              'If you need something, just lemme know, yeah? Alright, cool. So, what can I do you for?"'
              : '"Oh, hey, welcome back. What\'s new?"';
          },
          result: { type: 'BATTLE_START', info: {encounterName: 'Newtorial', nextState: 'itsOva'}}
          // result: { type: 'OPTIONS', info: {options: ['who', 'why', 'buy', 'open', 'open2', 'open3']}}
        },
        who: {
          userText: 'Who are you?',
          condition (worldManager) {
            return !this.logic.state.who;
          },
          onSay (worldManager) {
            this.logic.state.who = true;
          },
          responseText (worldManager) {
            return '"I already told you! Have you forgotten my name already? Can\'t you re... I mean, are you deaf? Oh, you mean, in a more general sense? ' +
              'Well, I used to be an adventurer like you, but then I took a course on economics, and I realised the trader life was far more lucrative. ' +
              'I studied for years as a spellcaster though, and I\'ve still got a few tricks up my sleeve. That\'s a warning, not a fun fact. Anything else?"';
          },
          result: { type: 'OPTIONS', info: {options: ['who', 'why', 'buy', 'open', 'open2', 'open3']}}
        },
        why: {
          userText: 'Why are you here?',
          condition (worldManager) {
            return !this.logic.state.why;
          },
          onSay (worldManager) {
            this.logic.state.why = true;
          },
          responseText (worldManager) {
            return '"Why are any of us here? For the Ether! Also, didn\'t they tell you? Once you come down here, they won\'t let you back up! ' +
              'The ether makes people crazy, and it really leeches in, if you\'re not careful. That\'s why I keep that door locked up tight when people aren\'t passing through. ' +
              'Is there anything else?"';
          },
          result: { type: 'OPTIONS', info: {options: ['who', 'why', 'buy', 'open', 'open2', 'open3']}}
        },
        buy: {
          userText: 'Can I buy something?',
          onSay (worldManager) {
            this.logic.state.askedBuyNoMoney++;
          },
          responseText (worldManager) {
            switch (this.logic.state.askedBuyNoMoney) {
              case 0:
                return '"Eh? What? I only trade in Ether, and I just saw you roll in, so unless you robbed someone on the way down, I know you don\'t have any."';
              case 1:
                return '"If you said were able to afford something from my stash, you\'re either a liar, or a hacker."';
              case 2:
                return '"Look, the currency system isn\'t even implemented! I don\'t even have anything to sell! It\'s all a ruse!"';
              default:
                return '...';
            }
          },
          result: { type: 'OPTIONS', info: {options: ['who', 'why', 'buy', 'open', 'open2', 'open3']}}
        },
        open: {
          userText: 'Can you open that door?',
          condition (worldManager) {
            return this.logic.state.declinedFight === 0 && !this.logic.state.fightCompleted;
          },
          responseText (worldManager) {
            return '"Hahahaha. Well, I usually open it for *adventurers*, but given that you have no equipment, I\'m inclined to decline."';
          },
          result: { type: 'OPTIONS', info: {options: ['pay', 'order', 'fight', 'gg']}}
        },
        pay: {
          userText: 'I\'ll pay you! Good money!',
          onSay (worldManager) {
            this.logic.state.pay = true;
          },
          condition (worldManager) {
            return !this.logic.state.pay;
          },
          responseText (worldManager) {
            return this.logic.state.askedBuyNoMoney === 0
              ? '"With what money? No, I don\'t give loans."'
              : '"You don\'t even have any money! We discussed this!"';
          },
          result: { type: 'OPTIONS', info: {options: ['pay', 'order', 'fight', 'gg']}}
        },
        order: {
          userText: 'By order of the King, open this door!',
          onSay (worldManager) {
            this.logic.state.order++;
          },
          responseText (worldManager) {
            return this.logic.state.order === 0
              ? '"Oh? The King orders? Why didn\'t you say so! Let me just go and hey wait a second, I\'m not falling for that one again!"'
              : '"Let me rephrase that again: I\'m not falling for that one again, mutiple times in quick succession"';
          },
          result: { type: 'OPTIONS', info: {options: ['pay', 'order', 'fight', 'gg']}}
        },
        fight: {
          userText: 'What I lack in loot I make up for in skill! Let me prove my worth!',
          responseText (worldManager) {
            return (this.logic.state.declinedFight === 0
              ? 'That sounds like a challenge!' : 'Finally! Sheesh!') + ' Alright, on guard!';
          },
          result: { type: 'BATTLE_START', info: {encounterName: 'Newtorial', nextState: 'itsOva'}}
        },
        gg: {
          userText: 'Alright, well, guess I\'m beaten. See you later!',
          onSay (worldManager) {
            this.logic.state.declinedFight++;
          },
          responseText (worldManager) {
            return '"Not going down without a fight huh wait what? You\'re giving up? What? Alright, well uh. See ya round?"';
          },
          result: { type: 'TALK_OVER', info: {newState: 'start'} }
        },
        open2: {
          userText: 'I\'ve reconsidered. Open the door, I\'m ready.',
          condition (worldManager) {
            return this.logic.state.declinedFight === 1 && !this.logic.state.fightCompleted;
          },
          responseText (worldManager) {
            return '"Well, *you* may have reconsidered, but you still have no gear. You\'re gonna have to prove to me you\'re not gonna end up another corpse on my front lawn. ' +
                'How else will I know?"';
          },
          result: { type: 'OPTIONS', info: {options: ['fight', 'gg2']}}
        },
        gg2: {
          userText: 'That\'s a valid point. I won\'t waste your time then. Take care!',
          onSay (worldManager) {
            this.logic.state.declinedFight++;
          },
          responseText (worldManager) {
            return '"Glad to see you finally came wait, what? Really? Again? Well. If a fight is too *scary* for you, I guess you\'ll just have to figure something else out. See ya."';
          },
          result: { type: 'TALK_OVER', info: {newState: 'start'} }
        },
        open3: {
          userText: 'I have realised there is no way out of this room other than that door. Let\'s fight.',
          condition (worldManager) {
            return this.logic.state.declinedFight === 2 && !this.logic.state.fightCompleted;
          },
          responseText (worldManager) {
            return '"What if you get hurt? You know there are some scary monsters out there, right? What if *I\'m* a scary monster? Are you sure?"';
          },
          result: { type: 'OPTIONS', info: {options: ['yes', 'yes2']}}
        },
        yes: {
          userText: 'Yes.',
          responseText (worldManager) {
            return 'I\'m glad you finally came around. Alright, on guard!';
          },
          result: { type: 'BATTLE_START', info: {encounterName: 'Newtorial', nextState: 'itsOva'}}
        },
        yes2: {
          userText: 'Yes, but as the second option.',
          responseText (worldManager) {
            return 'And who said your choices don\'t matter? Alright, on guard!';
          },
          result: { type: 'BATTLE_START', info: {encounterName: 'Newtorial', nextState: 'itsOva'}}
        },
        itsOva: {
          userText: null,
          responseText (worldManager) {
            return '"That was fun! Well, a deal is a deal. Here you go."';
          },
          onSay (worldManager) {
            this.logic.state.fightCompleted = true;
          },
          result: { type: 'TALK_OVER', info: {newState: 'start'} }
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
        undamagedTurns: 0
      },
      talkState: 'start',
      onTalk: {
        'start': {
          text: '"Here are some sample options!"',
          onSay (worldManager) {
            const lever = worldManager.getEntity(worldManager.currentRoom, 'Dungeon Lever');
            lever.logic.state.touched = true;
            worldManager.send('Clunk!');
          },
          result: ['OPTIONS', {text: 'Prepare to die!', state: 'fight'}, {text: 'Neat, cool, thanks!', state: 'cancel'}]
        },
        'fight': {
          text: 'No u!',
          result: ['BATTLE_START', 'Tutorial', 'fightReallyOver']
        },
        'cancel': {
          text: 'Alright, see you later!',
          result: ['TALK_OVER', 'start']
        },
        'fightover': {
          text: 'I am slain!',
          result: ['OPTIONS', {text: 'Yes.', state: 'fightReallyOver'}, {text: 'Yes but with more words.', state: 'fightReallyOver'}]
        },
        'fightReallyOver': {
          text: '*curls up and dies*',
          onSay (worldManager) {
            const lever = worldManager.getEntity(worldManager.currentRoom, 'Dungeon Lever');
            lever.logic.state.touched = true;
            worldManager.send('Clunk!');
          },
          result: ['TALK_OVER', 'dead']
        },
        'dead': {
          text: 'Please, no more.',
          result: ['TALK_OVER', 'dead']
        }
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

  let items = [];
  if (creatureDetails.itemNames) {
    for (let i = 0; i < creatureDetails.itemNames.length; i++) {
      let itemToEquip = Items.getItem(creatureDetails.itemNames[i]);
      itemToEquip.equipped = true;
      items.push(itemToEquip);
    }
  }

  let effects = [];
  if (creatureDetails.effects) {
    for (let i = 0; i < creatureDetails.effects.length; i++) {
      effects.push(Effects.getEffect(creatureDetails.effects[i]));
    }
  }

  let creatureToAdd = new Character(creatureDetails.name, displayName || creatureDetails.name, creatureDetails.description, 'CREATURE', creatureDetails.hp, creatureDetails.speed, creatureDetails.logic, abilities, items, effects);

  creatureToAdd.items.forEach(item => {
    item.owner = creatureToAdd;
  });

  creatureToAdd.effects.forEach(effect => {
    effect.whoApplied = creatureToAdd;
  });

  return creatureToAdd;
};
