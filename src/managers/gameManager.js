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
    while (msgObj) {
      await this.sendMsgObject(msgObj);
      msgObj = this.sendQueue.shift();
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

          /*
          // start the battle
          this.currentBattle = new BattleManager(this, Encounters.getEncounter('Tutorial'));
          let initResult = this.currentBattle.initialise();
          if (initResult === 'EXPLORING') this.battleNumber++;
          this.state = initResult;

          // Hack to skip game manager char set, DELETE THIS ON MASTER
          this.characterInFocus = true;
          return this.sendAll();
          */
        }
      }
      // Now we can bounce if the react is not from the right person
      if (!this.currentRoom || (!this.currentBattle && this.characterInFocus && this.characterInFocus.controller !== user.id)) return this.sendAll();
      do { // monkas
        // Validate queue
        if (this.queue.length === 0) {
          this.queue = Util.prepareQueue(Util.getEffectiveCharacters(this.players).players); // :v)
        }
        if (this.characterInFocus === null) {
          this.characterInFocus = this.queue.shift(); // Need to null out before going for another loop
          this.currentRoomActions = this.getRoomValidActions(this.currentRoom);
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
              }
              break;
            case 'BATTLING':
              let turnResult = this.currentBattle.performTurn({
                messageReaction: messageReaction,
                react: react,
                user: user,
                message: message
              });
              if (turnResult === 'EXPLORING') this.battleNumber++;
              this.state = turnResult;
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
                  this.send('What would you like to use to interact with ' + interactable.displayName + '?\n' + interactionList.msg, interactionList.icons, true);
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
    this.previousRoomLocation = this.previousRoomLocation ? this.currentRoomLocation : locationArray;
    this.currentRoomLocation = locationArray;
    this.currentRoom = this.currentFloor.map[locationArray[0]][locationArray[1]];

    this.currentRoom.onEnter(this);
    this.currentRoom.visited = true;
  }

  getRoomValidActions (room) {
    // Need to decide what are the valid actions fak
    let actionList = {
      'onTalk': [],
      'onInteract': [],
      'onInspect': []
    };
    let iconMap = {
      'onTalk': '💬',
      'onInteract': '✋',
      'onInspect': '🔍'
    };
    console.log(room);
    room.entities.forEach(entity => {
      if (!entity.logic) return;
      for (let prop in actionList) {
        if (entity.logic[prop]) actionList[prop].push(entity);
      }
    });
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
