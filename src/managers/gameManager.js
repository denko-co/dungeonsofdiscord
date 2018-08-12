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
        if (react === '✅') {
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
            await this.currentBattle.initialise();
          }
        }
        break;
    }
  }

  addPlayer (userId) {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].length === 0) {
        this.players[i].push(Classes.getClass('Matyr', userId));
      }
      return;
    }
    throw new Error('Too many players have been added!');
  }
};
