const _ = require('underscore'); // Common array manipulations usually
const tr = require('../translations/translations.json');
const Classes = require('../content/classes.js');
const Util = require('../util/util.js');
const Encounters = require('../content/encounters.js');
const Floors = require('../content/floors.js');
const BattleManager = require('./battleManager.js');

module.exports = class GameManager {
  constructor (bot, channelId) {
    this.bot = bot;
    this.channelId = channelId;
    this.messageId = null; // Current message in focus
    this.playerIds = null;
    this.players = [[], [], []]; // Players in current position order
    this.state = 'READYING';
    this.map = []; // Reference positions of different floor
    this.currentFloor = null;
    this.currentFloorLocation = null;
    this.currentRoom = null;
    this.currentRoomLocation = null; // [x, y]
    this.currentRoomActions = null;
    this.previousRoomLocation = null;
    this.currentBattle = null; // Reference to a BattleManager
    this.battleNumber = 1;
    this.characterInFocus = null; // Character currently taking turn
    this.currentOptionInfo = null; // What has already been picked by characterInFocus
    this.queue = []; // Turn order for non-battle actions
    this.sendQueue = []; // Stores all messages. When turn completes, sends the messages.
    this.gameQueue = Promise.resolve(); // Keeps track of Discord Events
  }

  initialise () {
    this.send(tr.welcome, ['🙋', '✅'], true);
    return this.sendAll();
  }

  // Send is not really a send, it's a push to queue to resolve later
  send (message, reactions, saveId) {
    console.log(`Sending '${message}'`);
    this.sendQueue.push({
      message: message,
      reactions: reactions,
      saveId: saveId
    });
  }

  async sendAll () {
    let msgObj = this.sendQueue.shift();
    let bulkMessageObj = null;
    while (msgObj) {
      if (msgObj.reactions) {
        // If msgObj has reactions, it should be sent as a separate message.
        if (bulkMessageObj !== null && bulkMessageObj.message.length >= 0) {
          // Send the bulkMessageObj before the reacted message.
          await this.sendMsgObject(bulkMessageObj);
          bulkMessageObj = null;
        }
        await this.sendMsgObject(msgObj);
      } else if (bulkMessageObj === null) {
        // If bulkMessageObj has been cleared, msgObj becomes its new base message.
        bulkMessageObj = msgObj;
      } else if (bulkMessageObj.message.length + msgObj.message > 2000) {
        // If bulkMessageObj will exceed the discord max character limit, split it.
        await this.sendMsgObject(bulkMessageObj);
        bulkMessageObj = msgObj;
      } else {
        bulkMessageObj.message += ('\n' + msgObj.message);
      }
      msgObj = this.sendQueue.shift();
    }
    if (bulkMessageObj !== null) {
      await this.sendMsgObject(bulkMessageObj);
    }
  }

  sendMsgObject (msgObj) {
    return this.bot.channels.get(this.channelId).send(msgObj.message).then(message => {
      if (msgObj.saveId) { this.messageId = message.id; }
      return Util.addReactions(message, msgObj.reactions);
    });
  }

  handleReaction (messageReaction, user) {
    if (messageReaction.message.id === this.messageId) {
      let react = messageReaction.emoji.name;
      let message = messageReaction.message;
      let reactions = message.reactions;
      if (!this.playerIds) {
        if (react !== '✅') return;
        // Setup players and get ready to rumble
        let ready = message.reactions.get('🙋');
        let readyConfirmed = false;
        let userIds = ready.users.filter(reactUser => !reactUser.bot).keyArray();
        if (userIds.size <= 1) {
          this.send(tr.tooSmall);
          messageReaction.remove(user);
        } else if (userIds.size >= 4) {
          this.send(tr.tooLarge);
          messageReaction.remove(user);
        } else if (!userIds.includes(user.id)) {
          this.send(tr.notOnQuest);
          messageReaction.remove(user);
        } else {
          this.playerIds = userIds;
          readyConfirmed = true;
        }
        if (!readyConfirmed) return this.sendAll();
        this.send(Util.mentionList(userIds) + tr.letsRock);
      }
      if (!this.currentRoom) {
        // Figure out who is supposed to be selecting
        let playerToChooseClass = this.getPlayerToChooseClass();
        if (!playerToChooseClass) throw new Error('No room available, but all players are set.');
        // Was this a confirm? If not, bounce it.
        if (!(react === '✅' && (this.state !== 'CLASS_SELECT' || user.id === playerToChooseClass))) return;
        // Get all the available classes
        let classList = this.getClassList();
        if (this.state === 'CLASS_SELECT') {
          // Got a confirm and a user, figure out if they've selected something valid
          let classConfirmed = false;
          let selectedClass = Util.getSelectedOptions(reactions, _.without(classList.icons, '✅'), user.id);
          console.log(selectedClass);
          if (selectedClass.length === 0) {
            // No option provided!
            this.send('Please select a class! Decisions are scary, I know. But you\'ve got to be brave!');
            messageReaction.remove(user);
          } else if (selectedClass.length > 1) {
            // Too many options provided!
            this.send('Too many choices! Only one pls!');
            messageReaction.remove(user);
          } else {
            // Got one, slam it
            this.addPlayer(playerToChooseClass, classList.classArray[Util.getEmojiNumbersAsInts(selectedClass)[0] - 1].name);
            // Rotate the player to choose class
            playerToChooseClass = this.getPlayerToChooseClass();
            classConfirmed = true;
          }
          if (!classConfirmed) return this.sendAll();
        }
        if (playerToChooseClass) {
          if (this.state !== 'CLASS_SELECT') this.state = 'CLASS_SELECT'; // ;)
          this.send(`${Util.getMention(playerToChooseClass)}, choose your class!\n` +
            `For more info about a class, type \`!info <class number>\`\n` + classList.msg, classList.icons, true);
        } else {
          // Start the game!
          this.send('Alright, everyone\'s chosen. Let\'s get started!');
          this.state = 'EXPLORING';

          this.enterFloor('DOWN');
        }
      }
      // If we have a battle, handle it!
      if (this.currentBattle) {
        let battleOver = this.currentBattle.performTurn({
          messageReaction: messageReaction,
          react: react,
          user: user,
          message: message
        });
        if (battleOver) {
          this.battleNumber++;
          this.currentBattle = null;
          if (this.state.startsWith('SELECT_TALK')) {
            let person = this.currentOptionInfo.person;
            if (person.alive) {
              person.logic.talkState = person.logic.onTalk[person.logic.talkState].result[2];
              this.handleConversation(person);
              if (this.state.startsWith('SELECT_TALK')) return this.sendAll(); // We are back in conversation, let the person respond
            }
          }
        }
      }

      // Now we can bounce if the react is not from the right person
      if (!this.currentRoom || this.currentBattle || (this.characterInFocus && this.characterInFocus.controller !== user.id)) return this.sendAll();
      do { // monkas
        // Validate queue
        if (this.queue.length === 0) {
          this.queue = Util.prepareQueue(Util.getEffectiveCharacters(this.players).players); // :v)
        }
        if (this.characterInFocus === null) {
          this.characterInFocus = this.queue.shift(); // Need to null out before going for another loop
          this.currentRoomActions = this.getRoomValidActions(this.currentRoom, this.characterInFocus);
          this.currentOptionInfo = null;
          this.send(Util.getDisplayName(this.characterInFocus) + ', you\'re up!');
          this.send('What would you like to do?', this.currentRoomActions.icons, true);
        } else {
          switch (this.state) {
            case 'EXPLORING':
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
                this.characterInFocus = null;
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
              } else if (options[0] === '🎁') {
                // Gifting! Giving? Choose an item first
                let giftables = Util.getNumberedList(this.currentRoomActions.actions.give);
                this.send('What item would you like to give?\n' + giftables.msg, giftables.icons, true);
                this.state = 'SELECT_GIVE';
              } else if (options[0] === '🗺') {
                // Moving between rooms, pick a direction
                let directions = Util.getNumberedList(this.currentRoomActions.actions.move.map(direction => Util.capitalise(direction)));
                this.send('Which direction would you like to move the party in?\n' + directions.msg, directions.icons, true);
                this.state = 'SELECT_MOVE';
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
                  let personLogic = this.currentOptionInfo.person.logic;
                  let currentState = personLogic.onTalk[personLogic.talkState];
                  personLogic.talkState = currentState.result[Util.getEmojiNumbersAsInts(talkOptions)].state;
                  this.handleConversation(this.currentOptionInfo.person);
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
                  this.state = 'EXPLORING';
                  this.characterInFocus = null;
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
                  this.state = 'EXPLORING';
                  this.characterInFocus = null;
                }
              }
              break;
            case 'SELECT_GIVE':
              if (react === '🚫') {
                this.cancelAction('Giving');
              } else if (react === '✅') {
                let giftables = Util.getNumberedList(this.currentRoomActions.actions.give, true);
                giftables = Util.getSelectedOptions(reactions, giftables.icons, user.id);
                if (giftables.length === 0) {
                  this.send('Please select an item to give.');
                  messageReaction.remove(user);
                } else if (giftables.length > 1) {
                  this.send('So generous! But please, one at a time.');
                  messageReaction.remove(user);
                } else {
                  let giftIndex = Util.getEmojiNumbersAsInts(giftables);
                  let gift = this.currentRoomActions.actions.give[giftIndex - 1];
                  let team = Util.getEffectiveCharacters(this.players).players;
                  let allies = _.without(team, this.characterInFocus);
                  this.currentOptionInfo = {gift: gift, allies: team};
                  // Give them choice on who to gift
                  // I swap allies <-> team depending on whether I'm testing or not
                  let alliesList = Util.getNumberedList(team);
                  this.currentOptionInfo = {gift: gift, allies: team, alliesList: alliesList};
                  this.send('Who would you like to give *' + Util.getDisplayName(gift) + '*?\n' + alliesList.msg, alliesList.icons, true);
                  this.state = 'SELECT_GIVE_TARGET';
                }
              }
              break;
            case 'SELECT_GIVE_TARGET':
              if (react === '🚫') {
                // Copy pasta of the gift code
                let giftables = Util.getNumberedList(this.currentRoomActions.actions.give);
                this.send('What item would you like to give?\n' + giftables.msg, giftables.icons, true);
                this.state = 'SELECT_GIVE';
              } else if (react === '✅') {
                // :thinking:
                let personsToGift = Util.getSelectedOptions(reactions, _.without(this.currentOptionInfo.alliesList.icons, '🚫', '✅'), user.id);
                if (personsToGift.length === 0) {
                  this.send('Please select a person to gift.');
                  messageReaction.remove(user);
                } else if (personsToGift.length > 1) {
                  this.send('Please select only one person - what are they gonna do, cut it up? Shared custody?');
                  messageReaction.remove(user);
                } else {
                  // Figure out person and item index
                  let personToGiftIndex = Util.getEmojiNumbersAsInts(personsToGift);
                  let personToGift = this.currentOptionInfo.allies[personToGiftIndex - 1];

                  // Give item to person
                  personToGift.items.push(this.currentOptionInfo.gift);
                  this.currentOptionInfo.gift.owner = personToGift;

                  // Take it away from the owner ;(
                  let giftIndex = this.characterInFocus.items.indexOf(this.currentOptionInfo.gift);
                  this.characterInFocus.items.splice(giftIndex, 1);

                  this.send('Transfer complete! Enjoy your loot.');
                  this.state = 'EXPLORING';
                  this.characterInFocus = null;
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
                  this.state = 'EXPLORING';
                  this.characterInFocus = null;
                }
              }
              break;
          }
        }
      } while (this.characterInFocus === null); // Only go back around if the char in focus has been unset
    }
    return this.sendAll();
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
        this.state = 'EXPLORING';
        this.characterInFocus = null;
        break;
      case 'BATTLE_START':
        this.currentBattle = new BattleManager(this, Encounters.getEncounter(result[0]));
        let battleOver = this.currentBattle.initialise();
        if (battleOver) {
          this.battleNumber++;
          this.currentBattle = null;
          if (person.alive) {
            person.logic.talkState = result[1];
            this.handleConversation(person);
          }
        }
        break;
    }
  }

  handleMessage (message) {
    let command = message.content.substring(1).toLowerCase();
    let cmdSplit = command.match(/\S+/g) || [];
    if (this.currentBattle && (command === 'battle' || command === 'battlefield')) {
      this.send(this.currentBattle.getBattlefield());
    } else if (this.state === 'CLASS_SELECT' && cmdSplit[0] === 'info') {
      if (!cmdSplit[1]) {
        this.send('Please specify which # class to get more info for.');
      } else {
        let index = parseInt(cmdSplit[1]);
        let classList = Classes.getClasses();
        if (isNaN(cmdSplit[1]) || index < 1 || index > classList.length) {
          this.send('Please specify a valid # for the class info.');
        } else {
          let selectedClass = classList[index - 1];
          this.send(`*${selectedClass.name} info:*\n${selectedClass.detailedDescription.split('\n').map(str => str.trim()).join(' ')}`);
        }
      }
    } else if (command === 'me') {
      this.players.forEach(arr => {
        arr.forEach(char => {
          if (char.controller === message.author.id) {
            this.send(char.getCharacterDetails(this.currentBattle));
          }
        });
      });
    }
    console.log(command);
    return this.sendAll();
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
      'give': [],
      'move': []
    };
    let iconMap = {
      'onTalk': '💬',
      'onInteract': '✋',
      'onInspect': '🔍',
      'give': '🎁',
      'move': '🗺'
    };
    room.entities.forEach(entity => {
      if (!entity.logic) return;
      for (let prop in actionList) {
        if (entity.logic[prop]) actionList[prop].push(entity);
      }
    });

    // If there's a char provided and they have loot, let them give stuff
    if (char) {
      // if (_.without(Util.getEffectiveCharacters(this.players).players, char).length !== 0) {
      for (let item of char.items) {
        actionList['give'].push(item);
      }
      // }
    }

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
    icons.push('🤷', '✅'); // Can always pass!

    return {actions: actionList, icons: icons};
  }

  getClassList () {
    let classInfo = Classes.getClasses();
    let numbers = Util.getNumbersAsEmoji();
    let classString = '';
    for (let i = 0; i < classInfo.length; i++) {
      classString += numbers[i] + ' - ' + classInfo[i].selectText + '\n';
    }
    let classIcons = numbers.slice(0, classInfo.length);
    classIcons.push('✅');
    return {msg: classString, icons: classIcons, classArray: classInfo};
  }

  getPlayerToChooseClass () {
    for (let i = 0; i < this.playerIds.length; i++) {
      if (!this.players[i][0]) {
        return this.playerIds[i];
      }
    }
    return null;
  }

  addPlayer (userId, className) {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].length === 0) {
        this.players[i].push(Classes.getClass(className, userId)); // Dynamic so will use correct copies
        this.send(`${Util.getMention(userId)} the ${className}, I like it! o/`);
        return;
      }
    }
    throw new Error('Too many players have been added!');
  }
};
