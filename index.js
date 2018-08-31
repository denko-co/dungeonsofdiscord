const Discord = require('discord.js');
const bot = new Discord.Client({autoReconnect: true});
const GameManger = require('./src/managers/gameManager.js');
const testChannel = '474806690848440324';
let gameManagers = {};

bot.login(process.env.TOKEN);

bot.on('ready', function (event) {
  console.log('Logged in as %s - %s\n', bot.user.username, bot.user.id);
  gameManagers[testChannel] = new GameManger(bot, testChannel);
  let gameManager = gameManagers[testChannel];
  gameManager.gameQueue = gameManager.gameQueue.then(() => gameManager.initialise());
});

bot.on('messageReactionAdd', function (messageReaction, user) {
  let channelId = messageReaction.message.channel.id;
  if (!user.bot && gameManagers[channelId]) {
    let gameManager = gameManagers[channelId];
    // console.log(messageReaction.emoji);
    gameManager.gameQueue = gameManager.gameQueue.then(() => gameManager.handleReaction(messageReaction, user));
  }
});

bot.on('message', function (message) {
  let channelId = message.channel.id;
  if (!message.author.bot && gameManagers[channelId]) {
    let gameManager = gameManagers[channelId];
    if (message.content.charAt(0) === '!') { // Swap this out for prefix later
      gameManager.gameQueue = gameManager.gameQueue.then(() => gameManager.handleMessage(message));
    }
  }
});
