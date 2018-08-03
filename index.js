var Discord = require('discord.js');
var bot = new Discord.Client({autoReconnect: true});

bot.login(process.env.TOKEN);

bot.on('ready', function (event) {
  console.log('Logged in as %s - %s\n', bot.user.username, bot.user.id);
});

bot.on('message', function (message) {
  if (!message.author.bot) {
    message.channel.send('Hey ya! <3');
  }
});
