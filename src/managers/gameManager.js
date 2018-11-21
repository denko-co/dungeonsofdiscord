// Util
const _ = require('underscore'); // Common array manipulations usually
const tr = require('../translations/translations.json');
const Util = require('../util/util.js');
// Managers
const WorldManager = require('./worldManager.js');
// Meta
const Classes = require('../content/classes.js');

module.exports = class GameManager {
  /*
    To explain, this is for handling everything that isn't actually taking your turn -
    * Holding character and player info
    * Deciding where the incoming actions should be going
    * Handling the queues
    * Handling commands <-- maybe this will be *refactored* later
  */
  constructor (bot, channelId) {
    // Meta info
    this.bot = bot; // Reference to the bot, so it can send and interact with Discord back
    this.channelId = channelId; // So it knows where to send messages
    this.messageId = null; // Current message in focus
    this.playerIds = null;
    // Game world info
    this.players = [[], [], []]; // Players in current position order
    this.world = null; // Actually only need to build the world once the game has started
    this.currentBattle = null; // Reference to the current BattleManager
    this.battleNumber = 1;
    // Meta queues
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
    // Bounce it if it's not being tracked, .sendAll is just for style
    if (messageReaction.message.id !== this.messageId) return this.sendAll();

    let react = messageReaction.emoji.name;
    let message = messageReaction.message;
    let reactions = message.reactions;
    // Someone is going to get this, so may as well construct it now
    let reactionInfo = {
      messageReaction: messageReaction,
      react: react,
      reactions: reactions,
      user: user,
      message: message
    };

    // Most 'activities' (such as picking players) will return true to say that we're good to go
    let lastActivityResult = false;

    // Handle the case where there are no players (just started playing)
    if (!this.playerIds) {
      lastActivityResult = this.handlePlayerReady(reactionInfo);
      // Still need to ready, await further input.
      if (!lastActivityResult) return this.sendAll();
    }

    // Handle the case where there is no current game world (missing some char info)
    if (!this.world) {
      lastActivityResult = this.handlePlayerClassSelection(reactionInfo, lastActivityResult);
      if (lastActivityResult) {
        this.world = new WorldManager(this);
        this.world.initialise();
      } else {
        return this.sendAll();
      }
    }

    if (!this.world) return this.sendAll(); // Nothing to do
    let battleCreated = false;
    do {
      // If we have a battle, handle it!
      if (this.currentBattle) {
        lastActivityResult = this.currentBattle.performTurn(battleCreated ? null : reactionInfo);
        if (lastActivityResult) { // If the battle is now over
          if (!this.currentBattle.isTemporary) {
            this.battleNumber++;
            lastActivityResult = this.world.onBattleComplete(); // World should exist here
            if (!lastActivityResult) return this.sendAll(); // We are back in conversation, let the person respond
          } else {
            if (lastActivityResult === 'CANCEL') {
              // Didn't actually do anything!
              this.world.queue.unshift(this.world.characterInFocus);
              this.world.characterInFocus = null;
            } else {
              this.world.cleanupCurrentCharacter();
            }
          }
          this.currentBattle = null;
        }
      }

      if (this.currentBattle) return this.sendAll(); // Stop us taking turns over and over and over

      // Battle stuff is all done (for now)
      lastActivityResult = this.world.performTurn(reactionInfo);
      if (lastActivityResult) {
        // Everybody is dead. End the game and stop responding to input.
        // Doesn't include DoT healing but we'll cross that bridge when we get to it.
        this.send('Everyone is dead and nobody is around to heal you. The end! ;~;');
        this.messageId = null;
      } else {
        battleCreated = this.currentBattle !== null;
      }
    } while (battleCreated); // Only go back around if the gameManager has created a new battle

    return this.sendAll(); // All done!
  }

  handleMessage (message) {
    if (!this.messageId) return;
    let command = message.content.substring(1).toLowerCase();
    let cmdSplit = command.match(/\S+/g) || [];
    if (this.currentBattle && (command === 'battle' || command === 'battlefield')) {
      this.send(this.currentBattle.getBattlefield());
    } else if (this.players && !this.world && cmdSplit[0] === 'info') {
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

  // Function to handle the ready up logic
  handlePlayerReady (reactionInfo) {
    let playerReadyResult = false;
    let { messageReaction, react, user, message } = reactionInfo;
    if (react === '✅') {
      // Setup players and get ready to rumble
      let ready = message.reactions.get('🙋');
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
        this.send(Util.mentionList(userIds) + tr.letsRock);
        playerReadyResult = true;
      }
    }
    return playerReadyResult;
  }

  // Function to handle the class selection logic
  handlePlayerClassSelection (reactionInfo, readyHappened) {
    let { messageReaction, react, reactions, user } = reactionInfo;

    // Figure out who is supposed to be selecting
    let playerToChooseClass = getPlayerToChooseClass.call(this);
    if (!playerToChooseClass) throw new Error('No world available, but all players are set.');
    // Was this a confirm? If not, bounce it.
    if (!(react === '✅' && (readyHappened || user.id === playerToChooseClass))) return false;
    // Get all the available classes
    let classList = getClassList.call(this);
    if (!readyHappened) {
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
        addPlayer.call(this, playerToChooseClass, classList.classArray[Util.getEmojiNumbersAsInts(selectedClass)[0] - 1].name);
        // Rotate the player to choose class
        playerToChooseClass = getPlayerToChooseClass.call(this);
        classConfirmed = true;
      }
      if (!classConfirmed) return false;
    }
    if (playerToChooseClass) {
      this.send(`${Util.getMention(playerToChooseClass)}, choose your class!\n` +
        `For more info about a class, type \`!info <class number>\`\n` + classList.msg, classList.icons, true);
    } else {
      // Start the game!
      this.send('Alright, everyone\'s chosen. Let\'s get started!');
    }
    return !playerToChooseClass;

    function getClassList () {
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

    function getPlayerToChooseClass () {
      for (let i = 0; i < this.playerIds.length; i++) {
        if (!this.players[i][0]) {
          return this.playerIds[i];
        }
      }
      return null;
    }

    function addPlayer (userId, className) {
      for (let i = 0; i < this.players.length; i++) {
        if (this.players[i].length === 0) {
          this.players[i].push(Classes.getClass(className, userId)); // Dynamic so will use correct copies
          this.send(`${Util.getMention(userId)} the ${className}, I like it! o/`);
          return;
        }
      }
      throw new Error('Too many players have been added!');
    }
  }
};
