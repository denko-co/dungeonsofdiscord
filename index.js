const Discord = require('discord.js');
const bot = new Discord.Client({autoReconnect: true});
const GameManger = require('./src/managers/gameManager.js');
const testChannel = '474806690848440324';
let gameManagers = {};

bot.login(process.env.TOKEN);

bot.on('ready', async function (event) {
  console.log('Logged in as %s - %s\n', bot.user.username, bot.user.id);
  gameManagers[testChannel] = new GameManger(bot, testChannel);
  await gameManagers[testChannel].initialise();
});

bot.on('messageReactionAdd', async function (messageReaction, user) {
  let channelId = messageReaction.message.channel.id;
  if (gameManagers[channelId]) {
    let gameManager = gameManagers[channelId];
    if (!user.bot && messageReaction.message.id === gameManager.messageId) {
      // console.log(messageReaction.emoji);
      await gameManager.handleReaction(messageReaction, user);
    }
  }
});

bot.on('message', async function (message) {
  let channelId = message.channel.id;
  if (!message.author.bot && gameManagers[channelId]) {
    let gameManager = gameManagers[channelId];
    if (message.content.charAt(0) === '!') { // Swap this out for prefix later
      await gameManager.handleMessage(message);
    }
  }
});
