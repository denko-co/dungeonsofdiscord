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

bot.on('messageReactionAdd', function (messageReaction, user) {
  if (user.bot) return;
  if (messageReaction.me && messageReaction.emoji.name === '🗑') {
    messageReaction.message.delete();
    return;
  }
  let channel = messageReaction.message.channel;
  let channelId = channel.id;
  if (gameManagers[channelId]) {
    let gameManager = gameManagers[channelId];
    // console.log(messageReaction.emoji);
    gameManager.gameQueue = gameManager.gameQueue.then(() => gameManager.handleReaction(messageReaction, user));
  } else if (channel.type === 'dm') {
    handlePlayerCard(messageReaction, user);
  }
});

function handlePlayerCard (messageReaction, user) {
  // Not sure if this is the right approach, blocked until game turn is complete
  console.log('Handling player card...');
  for (let game in gameManagers) {
    let gameManager = gameManagers[game];
    let playerCard = gameManager.playerCards.find(pc => pc.cardMessage.id === messageReaction.message.id);
    if (playerCard) {
      gameManager.gameQueue = gameManager.gameQueue.then(() => playerCard.handleReaction(messageReaction, user));
      return;
    }
    console.log(`Nothing found, exiting!`);
  }
}
