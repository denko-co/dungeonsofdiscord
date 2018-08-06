const Effect = require('./src/effect.js');
const Character = require('./src/character.js');

let testEffect = new Effect('Test effect', 'Do a test!', {
  printName (test) {
    console.log(`${this.name} and ${this.description} might be ${test}`);
  }
});

testEffect.printName('Wow!');

/*
const Discord = require('discord.js');
const bot = new Discord.Client({autoReconnect: true});

bot.login(process.env.TOKEN);

bot.on('ready', function (event) {
  console.log('Logged in as %s - %s\n', bot.user.username, bot.user.id);
});

bot.on('message', function (message) {
  if (!message.author.bot) {
    message.channel.send('Hey ya! <3');
  }
});
*/
