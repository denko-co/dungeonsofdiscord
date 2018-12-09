// This is for the player card, letting them look at stats without commands
const Util = require('../util/util.js');
const { createCanvas } = require('canvas');

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
      '🗺': 'getFloorMap',
      '❓': 'getIntroText'
    };
    // Can't remove reactions in DM's!
    let funct = mapping[react];
    if (funct) {
      this.state = funct;
      if (funct === 'getFloorMap') {
        let result = this[funct]();
        return this.cardMessage.channel.send(result[0], {
          file: {
            attachment: result[1],
            name: 'map.png'
          }
        });
      }
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
    // text += `Finally, 📖 opens up the manual, which tells you what buttons do in the game.\n\n`;
    text += `Phew, a lot of reading for a text based adventure eh? If you ever get stuck, you can always come back here using the ❓ button.\n`;
    text += `Oh, and by the way - if something is happening in game, I will update your card after it's done.\n`;
    text += `Good luck out there! You're gonna need it! ;)`;
    return text;
  }

  getFloorMap () {
    if (!this.game.world) return [`The game hasn't started yet! Check back here soon!`, null];
    // Values in px
    const BORDER = 40;
    const ROOM_WIDTH = 200;
    const ROOM_HEIGHT = 120;
    // These two are to figure out the canvas height
    let firstRoomIndex = null;
    let lastRoomIndex = null;
    // These two are for the canvas width
    let minimumRoomIndex = Infinity;
    let maximumRoomIndex = -Infinity;
    const floorToDraw = this.game.world.currentFloor.map;
    const floorHeight = floorToDraw.length;
    const floorLength = floorToDraw[0].length; // Floors should be non empty eh?
    for (let i = 0; i < floorHeight; i++) {
      for (let j = 0; j < floorLength; j++) {
        let room = floorToDraw[i][j];
        if (!room.visited) continue;
        if (!firstRoomIndex) firstRoomIndex = i;
        lastRoomIndex = i;
        if (j < minimumRoomIndex) minimumRoomIndex = j;
        if (j > maximumRoomIndex) maximumRoomIndex = j;
      }
    }

    const canvas = createCanvas(2 * BORDER + (maximumRoomIndex - minimumRoomIndex + 1) * ROOM_WIDTH,
      2 * BORDER + (lastRoomIndex - firstRoomIndex + 1) * ROOM_HEIGHT);
    const ctx = canvas.getContext('2d');
    const mapping = {
      up: [[0, 0], [1, 0]],
      down: [[0, 1], [1, 1]],
      left: [[0, 0], [0, 1]],
      right: [[1, 0], [1, 1]]
    };
    // Let's draw!
    for (let i = firstRoomIndex; i <= lastRoomIndex; i++) {
      for (let j = minimumRoomIndex; j <= maximumRoomIndex; j++) {
        const room = floorToDraw[i][j];
        const adjustedi = i - firstRoomIndex;
        const adjustedj = j - minimumRoomIndex;
        if (!room.visited) continue;
        for (let direction in mapping) {
          let linedash = [];
          if (room.directions[direction] !== undefined) {
            // Something this way
            if (room.directions[direction]) {
              // Free to go! Use big spaces.
              linedash = [10, 18];
            } else {
              // Door is locked, use thicc dashes
              linedash = [20, 5];
            }
          }
          // Otherwise solid line, use default

          // Draw the line in the right place
          const startPos = mapping[direction][0];
          const endPos = mapping[direction][1];
          ctx.beginPath();
          ctx.setLineDash(linedash);
          ctx.moveTo(BORDER + (adjustedj + startPos[0]) * ROOM_WIDTH,
            BORDER + (adjustedi + startPos[1]) * ROOM_HEIGHT);
          ctx.lineTo(BORDER + (adjustedj + endPos[0]) * ROOM_WIDTH,
            BORDER + (adjustedi + endPos[1]) * ROOM_HEIGHT);
          ctx.stroke(); // Hey, you and me both buddy
        }
      }
    }
    // Should be all draw now, send it back
    return [`Here's the map!`, canvas.toBuffer('image/png')];
  }
};
