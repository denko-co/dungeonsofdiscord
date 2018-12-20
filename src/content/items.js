const Abilities = require('./abilities.js');
const Item = require('../mechanics/item.js');
const Util = require('../util/util.js');

// Define all items
let items = {
  trainingSword: {
    name: 'Training Sword',
    description: 'A basic sword, weak, but effective. Never misses.',
    flavour: 'Some say that even a simple sword can slice arrows, in the right hands.',
    abilityNames: [
      'Whack'
    ],
    icon: '⚔',
    slot: 'hand'
  },
  trainingShield: {
    name: 'Training Shield',
    description: 'A basic shield, which negates Training Dummy damage.',
    flavour: 'Who\'s doing the training, you, or the dummy?',
    abilityNames: [
      'Dummy Defense'
    ],
    icon: '🛡',
    slot: 'hand'
  },
  spikedShield: {
    name: 'Spiked Shield',
    description: 'An offensive and defensive beginner\'s item.',
    flavour: 'The best defense is a good offense.',
    abilityNames: [
      ['Whack', 'Bash'],
      'Block'
    ],
    icon: '⚙',
    slot: 'hand'
  },
  lootBox: {
    name: 'Loot Box',
    description: 'Who knows what\'s inside?',
    abilityNames: [
      'Pop The Locks'
    ],
    icon: '📥',
    slot: 'hand2'
  },
  sudokuBooklet: {
    name: 'Sudoku Booklet',
    description: 'All of the pages are worn - and all the puzzles have been solved.',
    slot: 'hand',
    icon: '🔢'
  },
  bottledAnxiety: {
    name: 'Bottled Anxiety',
    description: 'A small vibrating vial of grey liquid. I wonder what this does?',
    flavour: 'It rattles, like it\'s nervous.',
    abilityNames: [
      'Make Worried'
    ],
    icon: '😰',
    slot: 'hand',
    onUse: {
      before (ability, battleManager) {
        if (ability.maxUses.game - 1 === ability.uses.game) {
          // It will pop now, print the use text
          battleManager.send('The bottle detonates on contact, releasing the fluid and BAD VIBES.');
        }
      },
      after (ability, battleManager) {
        if (ability.maxUses.game === ability.uses.game) {
          // Remove bottle from inventory
          this.owner.items.splice(this.owner.items.indexOf(this), 1);
        }
      }
    }
  }
};

exports.getItem = function (name, displayName) {
  let itemDetails = items[Util.convertName(name)];
  if (!itemDetails) {
    throw new Error(`Item with name ${name} not found!`);
  }
  let abilities = [];
  if (itemDetails.abilityNames) {
    for (let i = 0; i < itemDetails.abilityNames.length; i++) {
      let abil = itemDetails.abilityNames[i];
      if (Array.isArray(abil)) {
        abilities.push(Abilities.getAbility(...abil));
      } else {
        abilities.push(Abilities.getAbility(abil));
      }
    }
  }

  let itemToAdd = new Item(itemDetails.name, displayName || itemDetails.name, itemDetails.description, itemDetails.flavour, itemDetails.icon, itemDetails.slot, abilities, itemDetails.effects, itemDetails.onUse);
  return itemToAdd;
};
