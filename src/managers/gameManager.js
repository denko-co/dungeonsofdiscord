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
  }

  async initialise () {
    let startingMessage = await this.send(tr.welcome, true);
    Util.addReactions(startingMessage, ['🙋', '✅']);
  }

  async send (string, saveId) {
    console.log('Sending \'' + string + '\'');
    return this.bot.channels.get(this.channelId).send(string).then(message => {
      if (saveId) { this.messageId = message.id; }
      return message;
    });
  }

  async handleReaction (messageReaction, user) {
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
        } else {
          let playersToAddress = [];
          ready.users.forEach((user) => {
            if (!user.bot) {
              this.addPlayer(user.id);
              playersToAddress.push(user.id);
            }
          });
          await this.send(Util.mentionList(playersToAddress) + tr.letsRock);
          // start the battle
          this.currentBattle = new BattleManager(this, Encounters.getEncounter('Tutorial'));
          let initResult = await this.currentBattle.initialise();
          if (initResult === 'EXPLORING') this.battleNumber++;
          this.state = initResult;
        }
        break;
      case 'BATTLING':
        let turnResult = await this.currentBattle.performTurn({
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

  async handleMessage (message) {
    let command = message.content.substring(1).toLowerCase();
    if (this.currentBattle && (command === 'battle' || command === 'battlefield')) {
      await this.send(this.currentBattle.getBattlefield());
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
  }

  addPlayer (userId) {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].length === 0) {
        this.players[i].push(Classes.getClass('Matyr', userId)); // Dynamic so will use correct copies
      }
      return;
    }
    throw new Error('Too many players have been added!');
  }
};
