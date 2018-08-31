const tr = require('../translations/translations.json');
const Classes = require('../content/classes.js');
const Util = require('../util/util.js');
const Encounters = require('../content/encounters.js');
const BattleManager = require('./battleManager.js');

module.exports = class GameManager {
  constructor (bot, channelId) {
    this.bot = bot;
    this.channelId = channelId;
    this.messageId = null;
    this.players = [[], [], []];
    this.state = 'READY';
    this.currentBattle = null;
    this.battleNumber = 1;
    this.sendQueue = [];
    this.gameQueue = Promise.resolve();
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
      switch (this.state) {
        case 'READY':
          if (react !== '✅') return;
          // Setup players and get ready to rumble
          let ready = message.reactions.get('🙋');
          if (ready.users.size <= 1) {
            this.send(tr.tooSmall);
            messageReaction.remove(user);
          } else if (ready.users.size >= 4) {
            this.send(tr.tooLarge);
            messageReaction.remove(user);
          } else if (!ready.users.keyArray().includes(user.id)) {
            this.send(tr.notOnQuest);
            messageReaction.remove(user);
          } else {
            let playersToAddress = [];
            ready.users.forEach((user) => {
              if (!user.bot) {
                this.addPlayer(user.id);
                playersToAddress.push(user.id);
              }
            });
            this.send(Util.mentionList(playersToAddress) + tr.letsRock);
            // start the battle
            this.currentBattle = new BattleManager(this, Encounters.getEncounter('Tutorial'));
            let initResult = this.currentBattle.initialise();
            if (initResult === 'EXPLORING') this.battleNumber++;
            this.state = initResult;
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
      }
    }
    return this.sendAll();
  }

  handleMessage (message) {
    let command = message.content.substring(1).toLowerCase();
    if (this.currentBattle && (command === 'battle' || command === 'battlefield')) {
      this.send(this.currentBattle.getBattlefield());
    } else if (command === 'me') {
      this.players.forEach(arr => {
        arr.forEach(char => {
          if (char.owner === message.author.id) {
            this.send(char.getCharacterDetails(this.currentBattle));
          }
        });
      });
    }
    console.log(command);
    return this.sendAll();
  }

  addPlayer (userId) {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].length === 0) {
        this.players[i].push(Classes.getClass('Matyr', userId)); // Dynamic so will use correct copies
        return;
      }
    }
    throw new Error('Too many players have been added!');
  }
};
