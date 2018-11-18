const Discord = require('discord.js');
const bot = new Discord.Client({autoReconnect: true});
const credentials = require('./credentials.json');
const GameManger = require('./src/managers/gameManager.js');
const testChannel = credentials.TEST_CHANNEL_ID || '508067553848066069';
let gameMangers = {};

bot.login(process.env.TOKEN || credentials.DISCORD_TOKEN);

bot.on('ready', function (event) {
  console.log('Logged in as %s - %s\n', bot.user.username, bot.user.id);
  gameMangers[testChannel] = new GameManger(bot, testChannel);
  let gameManger = gameMangers[testChannel];
  gameManger.gameQueue = gameManger.gameQueue.then(() => gameManger.initialise());
});

bot.on('messageReactionAdd', function (messageReaction, user) {
  let channelId = messageReaction.message.channel.id;
  if (!user.bot && gameMangers[channelId]) {
    let gameManger = gameMangers[channelId];
    // console.log(messageReaction.emoji);
    gameManger.gameQueue = gameManger.gameQueue.then(() => gameManger.handleReaction(messageReaction, user));
  }
});

bot.on('message', function (message) {
  let channelId = message.channel.id;
  if (!message.author.bot && gameMangers[channelId]) {
    let gameManger = gameMangers[channelId];
    if (message.content.charAt(0) === '!') { // Swap this out for prefix later
      gameManger.gameQueue = gameManger.gameQueue.then(() => gameManger.handleMessage(message));
    }
  }
});
