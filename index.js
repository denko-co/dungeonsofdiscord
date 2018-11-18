const Discord = require('discord.js');
const bot = new Discord.Client({autoReconnect: true});
const credentials = require('./credentials.json');
const GameManger = require('./src/managers/worldManager.js');
const testChannel = credentials.TEST_CHANNEL_ID || '508067553848066069';
let worldManagers = {};

bot.login(process.env.TOKEN || credentials.DISCORD_TOKEN);

bot.on('ready', function (event) {
  console.log('Logged in as %s - %s\n', bot.user.username, bot.user.id);
  worldManagers[testChannel] = new GameManger(bot, testChannel);
  let worldManager = worldManagers[testChannel];
  worldManager.gameQueue = worldManager.gameQueue.then(() => worldManager.initialise());
});

bot.on('messageReactionAdd', function (messageReaction, user) {
  let channelId = messageReaction.message.channel.id;
  if (!user.bot && worldManagers[channelId]) {
    let worldManager = worldManagers[channelId];
    // console.log(messageReaction.emoji);
    worldManager.gameQueue = worldManager.gameQueue.then(() => worldManager.handleReaction(messageReaction, user));
  }
});

bot.on('message', function (message) {
  let channelId = message.channel.id;
  if (!message.author.bot && worldManagers[channelId]) {
    let worldManager = worldManagers[channelId];
    if (message.content.charAt(0) === '!') { // Swap this out for prefix later
      worldManager.gameQueue = worldManager.gameQueue.then(() => worldManager.handleMessage(message));
    }
  }
});
