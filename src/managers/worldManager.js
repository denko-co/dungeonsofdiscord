const _ = require('underscore'); // Common array manipulations usually
const Util = require('../util/util.js');
const Encounters = require('../content/encounters.js');
const Floors = require('../content/floors.js');
const BattleManager = require('./battleManager.js');

module.exports = class WorldManager {
  constructor (gameManager) {
    this.gameManager = gameManager; // To allow for info to be passed up or to request info
    this.state = 'EXPLORING';
    this.map = []; // Reference positions of different floors
    this.currentFloor = null;
    this.currentFloorLocation = null;
    this.currentRoom = null;
    this.currentRoomLocation = null; // [x, y]
    this.currentRoomActions = null;
    this.previousRoomLocation = null;
    this.queue = []; // Turn order for non-battle actions
    this.characterInFocus = null; // Character currently taking turn in world
    this.currentOptionInfo = null; // What has already been picked by characterInFocus
  }

  initialise () {
    this.enterFloor('Down');
  }

  performTurn (reactionInfo) {
    let { messageReaction, react, reactions, user } = reactionInfo;
    // Bounce if the react is not from the right person
    if (this.characterInFocus && this.characterInFocus.controller !== user.id) return;
    do { // monkas
      if (this.characterInFocus === null) {
        while (this.characterInFocus === null) {
          this.characterInFocus = this.queue.shift(); // Need to null out before going for another loop
          if (this.characterInFocus === undefined) {
            // We just shifted an empty array, so that means the last person in the list is dead or we're starting anew
            // Make a new list, check for survivors...
            this.queue = Util.prepareQueue(Util.getEffectiveCharacters(this.gameManager.players).players); // :v)
            if (this.queue.every(player => !player.alive)) {
              return true; // ONLY EVER RETURN TRUE IF EVERYONE IS DEAD
            } else {
              // Set to null, let the loop handle it
              this.characterInFocus = null;
            }
          } else if (!this.characterInFocus.alive) {
            // Not alive, clean them up
            this.cleanupCurrentCharacter();
          }
        }
        this.currentRoomActions = this.getRoomValidActions(this.currentRoom, this.characterInFocus);
        this.currentOptionInfo = null;
        this.send(Util.getDisplayName(this.characterInFocus) + ', you\'re up!');
        this.send('What would you like to do? If you\'re stuck, press ℹ for more info.', this.currentRoomActions.icons, true);
      } else {
        switch (this.state) {
          case 'EXPLORING':
            if (react === 'ℹ') {
              let mapping = {
                '💬': 'shows you who you can talk to in the room, and lets you talk to them.',
                '✋': 'shows you what you can interact with in the room, and tells you what you can use to interact with them.',
                '🔍': 'shows you what you can inspect in the room, basically an interface for using your eyes.',
                '🗺': 'shows you which directions you can move in, and lets you move. If all doors are locked, this will not be available.',
                '↕': 'allows you to drop and pick up things from the floor. Be careful! If you leave the room, they may not be there when you return.',
                '➡': 'swaps you to the battle context, letting you use combat actions out of combat.',
                '🤷': 'passes your turn, if decisions are too difficult.',
                'ℹ': 'shows you this, but you already knew that!'
              };
              let info = _.without(this.currentRoomActions.icons, '✅').map(icon => icon + ' ' + mapping[icon]).join('\n');
              this.send('*Here are what the buttons do:*\n' + info, ['🗑']);
              messageReaction.remove(user);
              break;
            }
            if (react !== '✅') break;
            // Option selected, ever get that feeling of dejavu?
            let options = Util.getSelectedOptions(reactions, _.without(this.currentRoomActions.icons, '✅'), user.id);
            if (options.length === 0) {
              // No option provided!
              this.send('Please select an action! To pass, press 🤷');
              messageReaction.remove(user);
            } else if (options.length > 1) {
              // Too many options provided!
              this.send('Too many choices! Only one pls!');
              messageReaction.remove(user);
            } else if (options[0] === '🤷') {
              // Player is passing, do nothing
              this.send('Passing? Are you sure? Alright then.');
              this.cleanupCurrentCharacter();
            } else if (options[0] === '💬') {
              // Talking , allow them to select a target
              let conversators = Util.getNumberedList(this.currentRoomActions.actions.onTalk);
              this.send('Who would you like to talk to?\n' + conversators.msg, conversators.icons, true);
              this.state = 'SELECT_TALK';
            } else if (options[0] === '✋') {
              // Interacting, allow them to select a target
              let interactables = Util.getNumberedList(this.currentRoomActions.actions.onInteract);
              this.send('What would you like to interact with?\n' + interactables.msg, interactables.icons, true);
              this.state = 'SELECT_INTERACT';
            } else if (options[0] === '🔍') {
              // Inspecting, allow them to select a target
              let inspectables = Util.getNumberedList(this.currentRoomActions.actions.onInspect);
              this.send('What would you like to take a look at?\n' + inspectables.msg, inspectables.icons, true);
              this.state = 'SELECT_INSPECT';
            } else if (options[0] === '🗺') {
              // Moving between rooms, pick a direction
              let directions = Util.getNumberedList(this.currentRoomActions.actions.move.map(direction => Util.capitalise(direction)));
              this.send('Which direction would you like to move the party in?\n' + directions.msg, directions.icons, true);
              this.state = 'SELECT_MOVE';
            } else if (options[0] === '↕') {
              let items;
              let msg;
              if (this.characterInFocus.items.length > 0) {
                msg = 'Which items would you like to drop?';
                items = Util.getNumberedList(this.characterInFocus.items);
                if (this.currentRoom.floorItems.length > 0) {
                  msg += ' To pick something up off the floor, press ➡';
                  let tickIndex = items.icons.indexOf('✅');
                  items.icons.splice(tickIndex, 0, '➡');
                }
              } else {
                // Must be something on the floor (or they wouldn't get this option!)
                msg = 'Which item would you like to pick up?';
                items = Util.getNumberedList(this.currentRoom.floorItems);
              }
              this.currentOptionInfo = {dropping: this.characterInFocus.items.length > 0, list: items};
              this.send(msg + '\n' + items.msg, items.icons, true);
              this.state = 'SELECT_GROUND';
            } else if (options[0] === '➡') {
              // They want to swap to battle context
              this.gameManager.currentBattle = new BattleManager(this, this.gameManager.players, null, this.characterInFocus);
            }
            break;
          case 'SELECT_GROUND':
            if (react === '🚫') {
              this.cancelAction('Drop/pick up');
            } else if (react === '✅') {
              let items = Util.getSelectedOptions(reactions, _.without(this.currentOptionInfo.list.icons, '🚫', '✅'), user.id);
              if (items.length === 0) {
                this.send('Please select at least one item');
                messageReaction.remove(user);
              } else if (!this.currentOptionInfo.dropping && items.length > 1) {
                this.send('You can\'t pick up mutiple items in one turn, or pick up and change modes.');
                messageReaction.remove(user);
              } else if (items.length > 1 && items.includes('➡')) {
                this.send('You can\'t drop stuff and change modes.');
                messageReaction.remove(user);
              } else {
                if (items[0] === '➡' || items[0] === '⬅') {
                  let chosen = items[0];
                  let opposite = chosen === '➡' ? '⬅' : '➡';
                  let msg = chosen === '➡'
                    ? 'Which item would you like to pick up? To drop things on the floor, press ⬅\n'
                    : 'Which items would you like to drop? To pick something up off the floor, press ➡\n';
                  let list = chosen === '➡' ? this.currentRoom.floorItems : this.characterInFocus.items;
                  let currentList = Util.getNumberedList(list);
                  let tickIndex = currentList.icons.indexOf('✅');
                  currentList.icons.splice(tickIndex, 0, opposite);
                  this.currentOptionInfo = {dropping: chosen !== '➡', list: currentList};
                  this.send(msg + currentList.msg, currentList.icons, true);
                } else {
                  // There is probably a clever js pattern for this...
                  let start = this.currentOptionInfo.dropping ? this.characterInFocus.items : this.currentRoom.floorItems;
                  let end = this.currentOptionInfo.dropping ? this.currentRoom.floorItems : this.characterInFocus.items;
                  let itemList = [];
                  Util.getEmojiNumbersAsInts(items).reverse().forEach(index => {
                    let item = start[index - 1];
                    if (this.currentOptionInfo.dropping) {
                      item.equipped = false;
                      item.owner = null;
                    } else {
                      item.owner = this.characterInFocus;
                    }
                    itemList.push(item);
                    end.push(item);
                    start.splice(index - 1, 1);
                  });
                  let formatted = Util.formattedList(Util.reduceList(itemList.map(item => Util.getDisplayName(item))));
                  this.send((this.currentOptionInfo.dropping ? 'Dropped ' : 'Picked up ') + '*' + formatted + '!*');
                  this.cleanupCurrentCharacter();
                }
              }
            }
            break;
          case 'SELECT_TALK':
            if (react === '🚫') {
              this.cancelAction('Conversation');
            } else if (react === '✅') {
              let conversators = Util.getNumberedList(this.currentRoomActions.actions.onTalk, true);
              conversators = Util.getSelectedOptions(reactions, conversators.icons, user.id);
              if (conversators.length === 0) {
                this.send('Please select someone to talk to. Don\'t worry, they won\'t bite! Maybe?');
                messageReaction.remove(user);
              } else if (conversators.length > 1) {
                this.send('Please select only one person to talk to. One mouth, one turn!');
                messageReaction.remove(user);
              } else {
                // Figure out who it is, run the talk script
                let conversatorIndex = Util.getEmojiNumbersAsInts(conversators);
                let conversator = this.currentRoomActions.actions.onTalk[conversatorIndex - 1];
                // Handle their conversation
                this.currentOptionInfo = {person: conversator};
                this.handleConversation(conversator);
              }
            }
            break;
          case 'SELECT_TALK_OPTION':
            if (react === '✅') {
              let talkOptions = Util.getSelectedOptions(reactions, _.without(this.currentOptionInfo.options.icons, '✅'), user.id);
              if (talkOptions.length === 0) {
                this.send('You say it best when you say something at all.');
                messageReaction.remove(user);
              } else if (talkOptions.length > 1) {
                this.send('Have you ever tried saying 2 things at the same time? Doesn\'t work out well.');
                messageReaction.remove(user);
              } else {
                // Set the new state
                let person = this.currentOptionInfo.person;
                person.logic.talkState = this.currentOptionInfo.stateList[Util.getEmojiNumbersAsInts(talkOptions) - 1];
                this.handleConversation(person);
              }
            }
            break;
          case 'SELECT_INSPECT':
            if (react === '🚫') {
              this.cancelAction('Inspect');
            } else if (react === '✅') {
              let inspectables = Util.getNumberedList(this.currentRoomActions.actions.onInspect, true);
              inspectables = Util.getSelectedOptions(reactions, inspectables.icons, user.id);
              if (inspectables.length === 0) {
                this.send('Please select something to inspect.');
                messageReaction.remove(user);
              } else if (inspectables.length > 1) {
                this.send('Please select only one inspectable. I know you have two eyes, but you only get one turn!');
                messageReaction.remove(user);
              } else {
                // Figure out what the item is, run it, and bounce back.
                let inspectableIndex = Util.getEmojiNumbersAsInts(inspectables);
                let inspectable = this.currentRoomActions.actions.onInspect[inspectableIndex - 1];
                inspectable.logic.onInspect(this);
                this.cleanupCurrentCharacter();
              }
            }
            break;
          case 'SELECT_INTERACT':
            if (react === '🚫') {
              this.cancelAction('Interact');
            } else if (react === '✅') {
              let interactables = Util.getNumberedList(this.currentRoomActions.actions.onInteract, true);
              interactables = Util.getSelectedOptions(reactions, interactables.icons, user.id);
              if (interactables.length === 0) {
                this.send('Please select something to interact with.');
                messageReaction.remove(user);
              } else if (interactables.length > 1) {
                this.send('Please select only one interactable. I know you have two hands, but you only get one turn!');
                messageReaction.remove(user);
              } else {
                // Give them the choices for what they will use to interact with
                let interactableIndex = Util.getEmojiNumbersAsInts(interactables);
                let interactable = this.currentRoomActions.actions.onInteract[interactableIndex - 1];

                // Figure out what they can actually use...
                let interactionItems = [];
                interactable.logic.interactionItems.forEach(item => {
                  if (item === 'Self') {
                    interactionItems.push(this.characterInFocus);
                  } else {
                    interactionItems.push(...this.characterInFocus.items.filter(charItem => charItem.name === item));
                  }
                });
                // Inspecting, allow them to select a target
                let interactionList = Util.getNumberedList(interactionItems);
                this.currentOptionInfo = {item: interactable, interactionItems: interactionItems, interactionList: interactionList};
                this.send('What would you like to use to interact with ' + Util.getDisplayName(interactable) + '?\n' + interactionList.msg, interactionList.icons, true);
                this.state = 'SELECT_INTERACT_ITEM';
              }
            }
            break;
          case 'SELECT_INTERACT_ITEM':
            if (react === '🚫') {
              // Copy pasta of the interact code
              // Interacting, allow them to select a target
              let interactables = Util.getNumberedList(this.currentRoomActions.actions.onInteract);
              this.send('Targeting cancelled. What would you like to interact with?\n' + interactables.msg, interactables.icons, true);
              this.state = 'SELECT_INTERACT';
            } else if (react === '✅') {
              // :thinking:
              let itemsToUse = Util.getSelectedOptions(reactions, _.without(this.currentOptionInfo.interactionList.icons, '🚫', '✅'), user.id);
              if (itemsToUse.length === 0) {
                this.send('Please select an item to use.');
                messageReaction.remove(user);
              } else if (itemsToUse.length > 1) {
                this.send('Please only one item to use at a time.');
                messageReaction.remove(user);
              } else {
                // Figure out what the item is, run it, and bounce back.
                let itemToUseIndex = Util.getEmojiNumbersAsInts(itemsToUse);
                let itemToUse = this.currentOptionInfo.interactionItems[itemToUseIndex - 1];
                this.currentOptionInfo.item.logic.onInteract(itemToUse, this);
                this.cleanupCurrentCharacter();
              }
            }
            break;
          case 'SELECT_MOVE':
            if (react === '🚫') {
              this.cancelAction('Movement');
            } else if (react === '✅') {
              let directions = Util.getNumberedList(this.currentRoomActions.actions.move, true);
              directions = Util.getSelectedOptions(reactions, directions.icons, user.id);
              if (directions.length === 0) {
                this.send('Please choose a direction to move in.');
                messageReaction.remove(user);
              } else if (directions.length > 1) {
                this.send('If you move in many directions at once, do you really move anywhere? Maybe, I failed my physics class.');
                messageReaction.remove(user);
              } else {
                // Move in the direction selected
                let mapping = {
                  up: [-1, 0],
                  down: [1, 0],
                  left: [0, -1],
                  right: [0, 1]
                };
                let directionIndex = Util.getEmojiNumbersAsInts(directions);
                let direction = this.currentRoomActions.actions.move[directionIndex - 1];
                let directCoord = mapping[direction];
                this.enterRoom([this.currentRoomLocation[0] + directCoord[0], this.currentRoomLocation[1] + directCoord[1]]);
                this.cleanupCurrentCharacter();
              }
            }
            break;
        }
      }
    } while (this.characterInFocus === null); // Only go back around if the char in focus has been unset
  }

  onBattleComplete () {
    if (this.characterInFocus.alive && this.state.startsWith('SELECT_TALK')) {
      let person = this.currentOptionInfo.person;
      console.log(person);
      if (person.alive) {
        person.logic.talkState = person.logic.onTalk[person.logic.talkState].result.info.nextState;
        this.handleConversation(person);
        if (this.state.startsWith('SELECT_TALK')) return false;
      }
    }
    this.cleanupCurrentCharacter();
    return true;
  }

  cancelAction (actionText) {
    // Bounce back to action select
    this.send(`${actionText} has been cancelled. What would you like to do?`, this.currentRoomActions.icons, true);
    this.state = 'EXPLORING';
  }

  getEntity (room, name) {
    return room.entities.find(entity => entity.name === name);
  }

  handleConversation (person) {
    let currentState = person.logic.onTalk[person.logic.talkState];
    this.send(currentState.responseText(this));
    if (currentState.onSay) currentState.onSay(this);
    let {type, info} = currentState.result;
    switch (type) {
      case 'OPTIONS':
        let stateList = info.options.filter(option => {
          let state = person.logic.onTalk[option];
          return !state.condition || state.condition(this);
        });
        let options = Util.getNumberedList(stateList.map(state => person.logic.onTalk[state].userText));
        this.currentOptionInfo.options = options;
        this.currentOptionInfo.stateList = stateList;
        this.send(Util.getDisplayName(this.characterInFocus) + ', what would you like to say?\n' + options.msg, _.without(options.icons, '🚫'), true);
        this.state = 'SELECT_TALK_OPTION';
        break;
      case 'TALK_OVER':
        person.logic.talkState = info.newState;
        this.cleanupCurrentCharacter();
        break;
      case 'BATTLE_START':
        this.gameManager.currentBattle = new BattleManager(this, this.gameManager.players, Encounters.getEncounter(info.encounterName, null, this.currentRoom.entities));
        this.gameManager.currentBattle.initialise();
        break;
    }
  }

  handleConversationOld (person) {
    let currentState = person.logic.onTalk[person.logic.talkState];
    this.send(currentState.text);
    if (currentState.onSay) currentState.onSay(this);
    let result = currentState.result.slice(1);
    let resultOption = currentState.result[0];
    switch (resultOption) {
      case 'OPTIONS':
        let options = Util.getNumberedList(result.map(res => res.text));
        this.currentOptionInfo.options = options;
        this.send(Util.getDisplayName(this.characterInFocus) + ', what would you like to say?\n' + options.msg, _.without(options.icons, '🚫'), true);
        this.state = 'SELECT_TALK_OPTION';
        break;
      case 'TALK_OVER':
        person.logic.talkState = result[0];
        this.cleanupCurrentCharacter();
        break;
      case 'BATTLE_START':
        this.gameManager.currentBattle = new BattleManager(this, this.gameManager.players, Encounters.getEncounter(result[0], null, this.currentRoom.entities));
        this.gameManager.currentBattle.initialise();
        break;
    }
  }

  enterFloor (direction) {
    if (!this.currentFloor) {
      // Prepare first floor
      this.currentFloor = Floors.getFloor('The Over Under');
      this.map.push(this.currentFloor);
      this.currentFloorLocation = 0;
    } else {
      // ???
    }
    this.currentFloor.onEnter(this);
    this.currentFloor.visited = true;

    this.enterRoom(this.currentFloor.startingRoomLocation);
  }

  enterRoom (locationArray) {
    if (this.currentRoom) this.currentRoom.onExit(this);
    this.previousRoomLocation = this.previousRoomLocation ? this.currentRoomLocation : locationArray;
    this.currentRoomLocation = locationArray;
    this.currentRoom = this.currentFloor.map[locationArray[0]][locationArray[1]];

    this.currentRoom.onEnter(this);
    this.currentRoom.visited = true;
  }

  getRoomValidActions (room, char) {
    // Need to decide what are the valid actions fak
    let actionList = {
      // These are from the entities in a room
      'onTalk': [],
      'onInteract': [],
      'onInspect': [],
      // These are from the char and room
      'move': []
    };
    let iconMap = {
      'onTalk': '💬',
      'onInteract': '✋',
      'onInspect': '🔍',
      'move': '🗺'
    };
    room.entities.forEach(entity => {
      if (!entity.logic || (entity.alive === false)) return;
      for (let prop in actionList) {
        if (entity.logic[prop]) actionList[prop].push(entity);
      }
    });

    // If there's a direction that can be moved in, provide the option
    for (let direction in room.directions) {
      if (room.directions[direction]) actionList['move'].push(direction);
    }

    let icons = [];
    for (let prop in actionList) {
      if (actionList[prop].length !== 0) {
        icons.push(iconMap[prop]);
      }
    }

    // Give player option to pick up and drop things from the floor out of combat
    if (char.items.length > 0 || room.floorItems.length > 0) icons.push('↕');

    icons.push('🤷', 'ℹ', '➡', '✅'); // Can always pass, can always get info, can always swap to battle mode

    return {actions: actionList, icons: icons};
  }

  cleanupEffects (caster, charactersToCleanup, battleManager) {
    charactersToCleanup.forEach(char => char.cleanupEffect(caster, battleManager || this));
    if (!battleManager) return;
    for (let i = 0; i < battleManager.battlefieldEffects.length; i++) {
      for (let j = battleManager.battlefieldEffects[i].length - 1; j >= 0; j--) {
        // Hmm, this looks familiar ...
        let effect = battleManager.battlefieldEffects[i][j];
        if (effect.whoApplied === caster) {
          if (effect.ticks === effect.currentTicks) {
            // Expire the effect
            if (effect.onRemoveBattlefield) {
              effect.onRemoveBattlefield(battleManager, caster);
            }
            battleManager.battlefieldEffects[i].splice(j, 1);
          } else {
            if (effect.onTickBattlefield) {
              effect.onTickBattlefield(battleManager, caster);
            }
            effect.currentTicks++;
          }
        }
      }
    }
  }

  cleanupCurrentCharacter () {
    // Now this, this is disgusting
    // We need to cleanup EVERYONE, in EVERY ROOM (EVEN WHERE WE AREN'T)
    this.cleanupEffects(this.characterInFocus, Util.getEffectiveCharacters(this.gameManager.players).players.concat(this.getWorldEntities()));
    this.state = 'EXPLORING';
    this.characterInFocus = null;
  }

  getWorldEntities () {
    let entities = [];
    // Pray for me
    this.map.forEach(floor => {
      floor.map.forEach(row => {
        row.forEach(room => {
          room.entities.forEach(entity => {
            if (entity.effects && entity.effects.length > 0) entities.push(entity);
          });
        });
      });
    });
    return entities;
  }

  send (message, reactions, saveId) {
    this.gameManager.send(message, reactions, saveId);
  }
};
