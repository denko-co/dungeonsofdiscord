// Util
const _ = require('underscore'); // Common array manipulations usually
const tr = require('../translations/translations.json');
const Util = require('../util/util.js');
// Managers
const WorldManager = require('./worldManager.js');
const PlayerManager = require('./playerManager.js');
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
    this.playerCards = []; // Player cards for use by index.js
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
        let items = this.currentBattle.itemsToDistribute;
        if (items) {
          this.handleLootDistribution(reactionInfo, this.currentBattle);
          lastActivityResult = items.length === 0;
        } else {
          lastActivityResult = this.currentBattle.performTurn(battleCreated ? null : reactionInfo);
        }
        if (lastActivityResult) { // If the battle is now over
          if (!this.currentBattle.isTemporary) {
            if (!items) {
              this.battleNumber++;
              // Do loot distro
              this.handleLootDistribution(reactionInfo, this.currentBattle);
              if (this.currentBattle.itemsToDistribute.length > 0) return this.sendAll();
            }
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

  // Function to handle loot distribution
  handleLootDistribution (reactionInfo, battle) {
    let players = Util.getEffectiveCharacters(this.players).players;
    let empty = false;
    if (!battle.itemsToDistribute) {
      // Battle just finished, generate the listo
      battle.itemsToDistribute = [].concat(...battle.graveyard.filter(dead => !dead.controller).map(dead => dead.items));
      if (players.length === 1 && battle.itemsToDistribute.length > 0) {
        battle.itemsToDistribute.forEach(item => {
          item.equipped = false;
          item.owner = players[0];
        });
        players[0].items.push(...battle.itemsToDistribute);
        let lootList = Util.formattedList(Util.reduceList(battle.itemsToDistribute.map(item => Util.getDisplayName(item))));
        battle.itemsToDistribute = [];
        this.send('It looks like you\'re the only person around, so you get all the loot (' + lootList + ')! Drop what you don\'t need later.');
        empty = true;
      } else if (battle.itemsToDistribute.length > 0) {
        this.send('Welcome to ***Need or Greed***, the show where bodies are looted, RNG is rampant, and most importantly, the contribution to the previous fight *doesn\'t matter.*');
        this.send('Let\'s get started!');
      } else {
        empty = true;
      }
    } else {
      // Reaction comes in, let's see if we need to run the distribution
      let {messageReaction, react, user, reactions } = reactionInfo;
      if (react === '✅') {
        let options = Util.getSelectedOptions(reactions, ['🙆', '🤷', '🙅'], user.id);
        if (options.length === 0) {
          // No option provided!
          this.send(`Please select a roll ${Util.getMention(user.id)}!`);
          messageReaction.remove(user);
          return;
        } else if (options.length > 1) {
          // Too many options provided!
          this.send(`Too many roll choices ${Util.getMention(user.id)}! Only one pls!`);
          messageReaction.remove(user);
          return;
        } else {
          // Let us consume...
          const need = reactions.get('🙆').users.keyArray().filter(userId => this.playerIds.includes(userId));
          const greed = reactions.get('🤷').users.keyArray().filter(userId => this.playerIds.includes(userId));
          const pass = reactions.get('🙅').users.keyArray().filter(userId => this.playerIds.includes(userId));
          if (need.length + greed.length + pass.length < players.length) return;
          let checkArray = need.length > 0 ? need : greed;
          if (checkArray.length === 0) {
            this.send(`What? Nobody wants this? Well, I guess ravens can have it then.`);
            battle.itemsToDistribute.shift();
          } else {
            let winner = null;
            do {
              let chances = checkArray.map(id => Math.random());
              let maxChance = null;
              let maxChancePos = null;
              for (let i = 0; i < chances.length; i++) {
                if (maxChance < chances[i]) {
                  maxChance = chances[i];
                  maxChancePos = i;
                } else if (maxChance === chances[i]) {
                  maxChancePos = null;
                  break;
                }
              }
              winner = maxChancePos;
            } while (winner === null);
            // We have a winner!
            let winnerPlayer = players.find(player => player.controller === checkArray[winner]);
            this.send(Util.getDisplayName(winnerPlayer) + ' wins! Enjoy!');
            let item = battle.itemsToDistribute.shift();
            console.log(battle.itemsToDistribute);
            item.owner = winnerPlayer;
            item.equipped = false;
            winnerPlayer.items.push(item);
          }
        }
      } else {
        return;
      }
    }
    if (battle.itemsToDistribute.length > 0) {
      let itemToGive = battle.itemsToDistribute[0];
      this.send('Who wants a *' + Util.getDisplayName(itemToGive) + '?* ' + Util.getNeedOrGreedStartText() +
      '\n\n*Here\'s the info:*\n' + itemToGive.getItemDetails() + '\n\n' +
      'Press 🙆 to roll Need, 🤷 to roll Greed, or 🙅 to pass.\nWhen you\'re ready, press ✅', ['🙆', '🤷', '🙅', '✅'], true);
    } else if (!empty) {
      this.send('Show\'s over folks!');
    }
  }

  // Function to handle the ready up logic
  handlePlayerReady (reactionInfo) {
    let playerReadyResult = false;
    let { messageReaction, react, user, reactions } = reactionInfo;
    if (react === '✅') {
      // Setup players and get ready to rumble
      let ready = reactions.get('🙋');
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
    if (!(['ℹ', '✅'].includes(react) && (readyHappened || user.id === playerToChooseClass))) return false;
    // Get all the available classes
    let classList = getClassList.call(this);
    if (!readyHappened) {
      // Got a confirm and a user, figure out if they've selected something valid
      let classConfirmed = false;
      let selectedClass = Util.getSelectedOptions(reactions, _.without(classList.icons, 'ℹ', '✅'), user.id);
      if (selectedClass.length === 0) {
        // No option provided!
        this.send('Please select a class! Decisions are scary, I know. But you\'ve got to be brave!');
        messageReaction.remove(user);
      } else if (selectedClass.length > 1) {
        // Too many options provided!
        this.send('Too many choices! Only one pls!');
        messageReaction.remove(user);
      } else {
        // Got one, figure out what the action actually is
        let classIndex = Util.getEmojiNumbersAsInts(selectedClass)[0] - 1;
        let selected = classList.classArray[classIndex];
        if (react === 'ℹ') {
          this.send(`*${selected.name} info:*\n${selected.detailedDescription.split('\n').map(str => str.trim()).join(' ')}`, ['🗑']);
          messageReaction.remove(user);
        } else {
          addPlayer.call(this, user, selected.name);
          // Rotate the player to choose class
          playerToChooseClass = getPlayerToChooseClass.call(this);
          classConfirmed = true;
        }
      }
      if (!classConfirmed) return false;
    }
    if (playerToChooseClass) {
      this.send(`${Util.getMention(playerToChooseClass)}, choose your class!\n` +
        `For more info about a class, select one, then press ℹ.\n` + classList.msg, classList.icons, true);
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
      classIcons.push('ℹ', '✅');
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

    function addPlayer (user, className) {
      for (let i = 0; i < this.players.length; i++) {
        if (this.players[i].length === 0) {
          let player = Classes.getClass(className, user.id);
          let playerCard = new PlayerManager(user, player, this);
          this.playerCards.push(playerCard);
          this.players[i].push(player); // Dynamic so will use correct copies
          this.send(`${Util.getMention(user.id)} the ${className}, I like it! o/`);
          return;
        }
      }
      throw new Error('Too many players have been added!');
    }
  }
};
