const pluralize = require('pluralize');

exports.convertName = function (name) {
  // Algorithms xd
  let shortened = name.replace(/\s+/g, '');
  return capitalise(shortened);
};

const capitalise = function (string) {
  return string.charAt(0).toLowerCase() + string.slice(1);
};

exports.capitalise = capitalise;

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
    let result = finalCounts[ele] > 1 ? finalCounts[ele] + ' ' + pluralize(ele) : getIndefiniteArticle(ele) + ele;
    resultList.push(result);
  }
  return resultList;
};

exports.addReactions = function (message, reactionsArray) {
  if (reactionsArray.length === 0) return;
  message.react(reactionsArray.shift()).then(messageReaction => {
    this.addReactions(messageReaction.message, reactionsArray);
  });
};
