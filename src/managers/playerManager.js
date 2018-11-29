// This is for the player card, letting them look at stats without commands
const Util = require('../util/util.js');

module.exports = class PlayerManager {
  constructor (user, playerRef, gameRef) {
    this.player = playerRef;
    this.game = gameRef;
    this.state = 'getIntroText';
    // Might run into problems here trying to restore a `message` from the db
    user.send(this.getIntroText()).then((message) => {
      this.cardMessage = message;
      return Util.addReactions(message, ['❤', '🤸', '👜', '⚔', '🗺', '❓']);
    });
  }

  handleReaction (messageReaction, user) {
    let react = messageReaction.emoji.name;
    let mapping = {
      '❤': 'getPlayerOverviewText',
      '🤸': 'getPlayerLoadoutText',
      '👜': 'getIntroText',
      '⚔': 'getIntroText',
      '🗺': 'getIntroText',
      '❓': 'getIntroText'
    };
    // Can't remove reactions in DM's!
    let funct = mapping[react];
    if (funct) {
      this.state = funct;
      return this.cardMessage.edit(this[funct]());
    }
    return Promise.resolve();
  }

  getPlayerLoadoutText () {
    let player = this.player;
    let loadout = {
      head: [],
      hand: [],
      chest: [],
      footsies: [],
      extra: []
    };
    player.items.forEach(item => {
      if (item.equipped) {
        if (item.slot.startsWith('hand')) {
          loadout['hand'].push(item);
        } else {
          loadout[item.slot].push(item);
        }
      }
    });
    let text = '*Equipped items for ' + Util.getDisplayName(player) + '*\n';
    for (let slot in loadout) {
      text += '*' + Util.capitalise(slot) + ' items:*';
      if (loadout[slot].length === 0) {
        text += ' *empty*\n';
      } else {
        loadout[slot].forEach(item => {
          text += '\n' + item.getItemDetails();
        });
        text += '\n';
      }
      text += '\n';
    }
    return text;
  }

  getPlayerOverviewText () {
    let player = this.player;
    let text = '*Details for ' + Util.getDisplayName(player) + '* ';
    text += (player.alive ? '(' + player.currenthp + '/' + player.hp + ' hp)' : '(dead ;~;)') + '\n\n';
    text += '*Abilities:* ' + (player.abilities.length === 0 ? '-' : '') + '\n';
    player.abilities.forEach(ability => {
      text += ability.getAbilityDetails() + '\n';
    });
    text += '\n';
    text += '*Character Effects:* ' + (player.effects.length === 0 ? '-' : '') + '\n';
    player.effects.forEach(effect => {
      text += effect.getEffectDetails(player) + '\n';
    });
    text += '\n';
    if (this.game.currentBattle) {
      let battleManager = this.game.currentBattle;
      let location = battleManager.getCharacterLocation(player);
      if (location) {
        let battleEffects = battleManager.battlefieldEffects[location.arrayPosition];
        text += '*Battlefield Effects:* ' + (battleEffects.length === 0 ? '-' : '') + '\n';
        battleEffects.forEach(bfEffect => {
          text += bfEffect.getEffectDetails() + '\n';
        });
        text += '\n';
      }
    }
    text += '*See the item menus for item breakdowns.*';
    return text;
  }

  getIntroText () {
    let userMention = Util.getMention(this.player.controller);
    let text = '';
    text += `Hey ${userMention}, again, welcome to ***DUNGEONS OF DISCORD***. This is your handy dandy player card.\n`;
    text += `It contains important information about you, the game, and how to play!\n\n`;
    text += `*Here are what the buttons do:*\n`;
    text += `❤ shows core info about you, like your HP and any effects currently applied.\n`;
    text += `🤸 shows what you currently have equipped and what those things do, plus any state info.\n`;
    text += `👜 shows what you currently have in your bag. As the bag is bottomless, this is an overview, with drilldowns.\n`;
    text += `⚔ shows battle info, so your position in an out of combat, HP of allies, and any in battle effect positions.\n`;
    text += `Finally, 🗺 shows world info, specifically, the current floor, where you are, and any points of interest.\n`;
    // msg += `Finally, 📖 opens up the manual, which tells you what buttons do in the game.\n\n`;
    text += `Phew, a lot of reading for a text based adventure eh? If you ever get stuck, you can always come back here using the ❓ button.\n`;
    text += `Oh, and by the way - if something is happening in game, I will update your card after it's done.\n`;
    text += `Good luck out there! You're gonna need it! ;)`;
    return text;
  }
};
