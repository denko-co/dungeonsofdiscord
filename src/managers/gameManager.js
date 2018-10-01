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
    this.messageId = null;
    this.playerIds = null;
    this.players = [[], [], []];
    this.state = 'READYING';
    this.map = [];
    this.currentFloor = null;
    this.currentFloorLocation = null;
    this.currentRoom = null;
    this.currentRoomLocation = null;
    this.previousRoomLocation = null;
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

        /*
        // Prepare first floor
        this.currentFloor = Floors.getFloor('The Over Under');
        this.map.push(this.currentFloor);
        this.currentFloorLocation = 0;
        this.currentRoomLocation = this.currentFloor.startingRoomLocation;
        this.previousRoomLocation = this.currentRoomLocation;
        this.currentRoom = this.currentFloor.map[this.currentRoomLocation[0]][this.currentRoomLocation[1]];

        // Run visits
        this.currentFloor.onEnter(this);
        this.currentFloor.visited = true;
        this.currentRoom.onEnter(this);
        this.currentRoom.visited = true;

        /*
        // start the battle
        this.currentBattle = new BattleManager(this, Encounters.getEncounter('Tutorial'));
        let initResult = this.currentBattle.initialise();
        if (initResult === 'EXPLORING') this.battleNumber++;
        this.state = initResult;
        */
      }
      if (!this.currentRoom) {
        // Figure out who is supposed to be selecting
        let playerToUpdate;
        for (let i = 0; i < this.playerIds.length; i++) {
          if (!this.players[i][0]) {
            playerToUpdate = this.playerIds[i];
            break;
          }
        }
        if (!playerToUpdate) throw new Error('No room available, but all players are set.');
        // Was this a confirm? If not, bounce it.
        if (!(react === '✅' && (this.state !== 'CLASS_SELECT' || user.id === playerToUpdate))) return;
        // Get all the available classes
        let classList = this.getClassList();
        if (this.state === 'CLASS_SELECT') {

        } else {
          this.state = 'CLASS_SELECT'; // ;)
          this.send(`${Util.getMention(playerToUpdate)}, choose your class!\n` +
            `For more info about a class, type \`!info <class number>\`\n` + classList.msg, classList.icons, true);
        }
      }
      switch (this.state) {
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
          if (char.owner === message.author.id) {
            this.send(char.getCharacterDetails(this.currentBattle));
          }
        });
      });
    }
    console.log(command);
    return this.sendAll();
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
    return {msg: classString, icons: classIcons, classObj: classInfo};
  }

  addPlayer (userId) {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].length === 0) {
        this.players[i].push(Classes.getClass('Battle Medic', userId)); // Dynamic so will use correct copies
        return;
      }
    }
    throw new Error('Too many players have been added!');
  }
};
