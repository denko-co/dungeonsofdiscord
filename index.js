const Discord = require('discord.js');
const bot = new Discord.Client({autoReconnect: true});
const credentials = require('./credentials.json');
const GameManager = require('./src/managers/gameManager.js');
const testChannel = credentials.TEST_CHANNEL_ID || '508067553848066069';
let gameManagers = {};

bot.login(process.env.TOKEN || credentials.DISCORD_TOKEN);

bot.on('ready', function (event) {
  console.log('Logged in as %s - %s\n', bot.user.username, bot.user.id);
  gameManagers[testChannel] = new GameManager(bot, testChannel);
  let gameManager = gameManagers[testChannel];
  gameManager.gameQueue = gameManager.gameQueue.then(() => gameManager.initialise());
});

bot.on('messageReactionRemove', function (messageReaction, user) {
  if (user.bot) return;
  // Treat this like a button press instead of an unpress
  handlePlayerCard(messageReaction, user);
});

bot.on('messageReactionAdd', function (messageReaction, user) {
  if (user.bot) return;
  let channelId = messageReaction.message.channel.id;
  if (gameManagers[channelId]) {
    let gameManager = gameManagers[channelId];
    // console.log(messageReaction.emoji);
    gameManager.gameQueue = gameManager.gameQueue.then(() => gameManager.handleReaction(messageReaction, user));
  }
  handlePlayerCard(messageReaction, user);
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

function handlePlayerCard (messageReaction, user) {
  // Not sure if this is the right approach, blocked until game turn is complete
  for (let game in gameManagers) {
    let gameManager = gameManagers[game];
    let playerCard = gameManager.playerCards.find(pc => pc.cardMessage === messageReaction.message);
    if (playerCard) {
      gameManager.gameQueue = gameManager.gameQueue.then(() => playerCard.handleReaction(messageReaction, user));
      return;
    }
  }
}
