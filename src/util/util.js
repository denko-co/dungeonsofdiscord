exports.convertName = function (name) {
  // Algorithms xd
  let shortened = name.replace(/\s+/g, '');
  return shortened.charAt(0).toLowerCase() + shortened.slice(1);
};

const getMention = function (userId) {
  return '<@' + userId + '>';
};

exports.getMention = getMention;

exports.mentionList = function (userIdArray) {
  const mentionArray = userIdArray.map((userId) => {
    return getMention(userId);
  });
  return [mentionArray.slice(0, -1).join(', '), mentionArray.slice(-1)[0]].join(mentionArray.length < 2 ? '' : ' and ');
};

exports.addReactions = function (message, reactionsArray) {
  if (reactionsArray.length === 0) return;
  message.react(reactionsArray.shift()).then((messageReaction) => {
    this.addReactions(messageReaction.message, reactionsArray);
  });
};
