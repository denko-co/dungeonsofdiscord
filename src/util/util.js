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

const getIndefiniteArticle = function (words) {
  const vowels = ['a', 'e', 'i', 'o', 'u'];
  return vowels.includes(words.charAt(0).toLowerCase()) ? 'an' : 'a';
};

exports.getIndefiniteArticle = getIndefiniteArticle;

const formattedList = function (array) {
  return [array.slice(0, -1).join(', '), array.slice(-1)[0]].join(array.length < 2 ? '' : ' and ');
};

exports.formattedList = formattedList;

exports.mentionList = function (userIdArray) {
  const mentionArray = userIdArray.map(userId => {
    return getMention(userId);
  });
  return formattedList(mentionArray);
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
  let resultList = [];
  for (let ele in finalCounts) {
    let result = finalCounts[ele] > 1 ? finalCounts[ele] + ' ' + pluralize(ele) : getIndefiniteArticle(ele) + ' ' + ele;
    resultList.push(result);
  }
  return resultList;
};

exports.addReactions = function (message, reactionsArray) {
  if (reactionsArray.length === 0) return;
  let reaction = reactionsArray.shift();
  message.react(reaction).then(messageReaction => {
    this.addReactions(messageReaction.message, reactionsArray);
  });
};

exports.getVsText = function (vs) {
  return 'Our heroes!\n**vs**\n' + vs + '!';
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

exports.getNumbersAsEmoji = function () {
  return ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣'];
};
