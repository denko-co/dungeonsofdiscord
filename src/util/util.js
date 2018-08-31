const pluralize = require('pluralize');
const _ = require('underscore');

exports.convertName = function (name) {
  // Algorithms xd
  let shortened = name.replace(/\s+/g, '');
  return uncapitalise(shortened);
};

const capitalise = function (string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

exports.capitalise = capitalise;

const uncapitalise = function (string) {
  return string.charAt(0).toLowerCase() + string.slice(1);
};

exports.uncapitalise = uncapitalise;

const getMention = function (userId) {
  return '<@' + userId + '>';
};

exports.getMention = getMention;

const getDisplayName = function (char) {
  return char.owner ? this.getMention(char.owner) : char.name;
};

exports.getDisplayName = getDisplayName;

const getIndefiniteArticle = function (words) {
  if (words.charAt(0) === '<') return '';
  const vowels = ['a', 'e', 'i', 'o', 'u'];
  return vowels.includes(words.charAt(0).toLowerCase()) ? 'an' : 'a';
};

exports.getIndefiniteArticle = getIndefiniteArticle;

const formattedList = function (array) {
  return [array.slice(0, -1).join(', '), array.slice(-1)[0]].join(array.length < 2 ? '' : ' and ');
};

exports.formattedList = formattedList;

exports.mentionList = function (userIdArray) {
  const mentionArray = userIdArray.map(userId => getMention(userId));
  return formattedList(mentionArray);
};

exports.titleCase = function (string, seperator) {
  let result = string.split('_');
  let upperResult = result.map(string => this.capitalise(string.toLowerCase()));
  return upperResult.join(seperator || ''); // Thanks eslint!
};

exports.reduceList = function (list) {
  let finalCounts = {};
  list.forEach(element => {
    if (finalCounts[element]) {
      finalCounts[element]++;
    } else {
      finalCounts[element] = 1;
    }
  });

  // This should use map :v)
  let resultList = [];
  for (let ele in finalCounts) {
    let indef = getIndefiniteArticle(ele);
    let indefString = indef + (indef ? ' ' : '');
    let result = finalCounts[ele] > 1 ? finalCounts[ele] + ' ' + pluralize(ele) : indefString + ele;
    resultList.push(result);
  }
  return resultList;
};

exports.addReactions = function (message, reactionsArray) {
  if (!reactionsArray) return Promise.resolve();
  return reactionsArray.reduce((prev, reaction) => prev.then(() => message.react(reaction)), Promise.resolve());
};

exports.getVsText = function (vs) {
  let lbreak = '------------\n';
  return lbreak + 'Our heroes!\n**vs**\n' + vs + '!\n' + lbreak;
};

// Now THIS is a good meme

exports.getBattleReadyText = function () {
  const ready = [
    'Good day for a swell battle!',
    'This match will get red hot!',
    'Here\'s a real high-class bout!',
    'A great slam and then some!',
    'A brawl is surely brewing!'
  ];
  return _.sample(ready);
};

exports.getBattleStartText = function () {
  const wallop = [
    'And begin!',
    'Now go!',
    'Here goes!',
    // 'You\'re up!',
    'It\'s on!'
  ];
  return _.sample(wallop);
};

exports.getEffectiveCharacters = function (arrayOfArrays) {
  let playersArray = [];
  let enemiesArray = [];
  arrayOfArrays.forEach(subarray => {
    subarray.forEach(character => {
      if (character.owner) {
        playersArray.push(character);
      } else {
        enemiesArray.push(character);
      }
    });
  });
  return {players: playersArray, enemies: enemiesArray};
};

const getNumbersAsEmoji = function () {
  return ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣'];
};
exports.getNumbersAsEmoji = getNumbersAsEmoji;

exports.getEmojiNumbersAsInts = function (array) {
  let mappings = this.getNumbersAsEmoji();
  return array.map(ele => mappings.indexOf(ele) + 1);
};

exports.clone = function (orig) {
  // Blame https://stackoverflow.com/questions/41474986/how-to-clone-a-javascript-es6-class-instance
  return Object.assign(Object.create(Object.getPrototypeOf(orig)), orig);
};
