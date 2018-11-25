const Abilities = require('./abilities.js');
const Character = require('../mechanics/character.js');
const Items = require('./items.js');
const Effects = require('./effects.js');
const Util = require('../util/util.js');

// Define all classes (instances as players, stored elsewhere...)

let classes = {
  battleMedic: {
    name: 'Battle Medic',
    description: `A healer, a tank, a heavy weapons guy, a light weapons guy, a friend.`,
    detailedDescription: `The Battle Medic uses their inner strength to heal their allies and beatdown their foes.
      With the highest health pool and passive HP regeneration, their abilities allow them to donate their HP to friends,
      or soak damage for them if required. Additionally, their natural affinity for melee weapons and armour makes them
      a perfect choice for a frontline combatant. Just make sure you're watching both your allies HP and your own -
      you can't use your abilities if you're dead.`,
    hp: 14,
    itemNames: [
      'Spiked Shield',
      'Spiked Shield'
    ],
    abilityNames: [
      'Healing Hands'
    ],
    effects: [
      'Flesh Heal',
      'Battle Buff'
    ]
  },
  loneRanger: {
    name: '"Lone" Ranger',
    description: `A sniper, a sharpshooter, a tracker, a forager, a companion.`,
    detailedDescription: `The "Lone" Ranger prefers to keep their distance, dealing T H I C C damage to enemies from a far.
      Their natural affinity for ranged weapons and items makes them a good choice for picking off dangerous foes, providing cover
      for the rest of the team. Focusing down a target grants them bonus damage, as long as they don't get distracted, by
      enemies, or loot, or having a limb removed. All that time alone also gave them time to learn some survival skills - the
      Ranger is able to stabilise their comrades, removing some effects, and their resourcefulness allows them to find useful
      items in the strangest of places.`,
    hp: 10,
    itemNames: [
      'Training Sword'
    ]
  },
  rogueBard: {
    name: 'Rogue Bard',
    description: `A trickster, a thief, a speedster, a shadow, an ally.`,
    detailedDescription: `The Rogue Bard is a artful individual - 4 years of music school actually paid off,
      allowing them to command instruments to potent effect. Down here, music can be used to daze foes, deal damage,
      buff and heal allies, the whole shabam. However, like all performing arts, sometimes these skills can fall flat,
      so hopefully you have good timing, or good luck, yeah? What the Rogue Bard Bard Rogue lacks in HP and direct damage is
      counterbalanced by their quick wits and sly tricks - they often act first in most combats, and once per battle can disappear
      briefly to collect themselves, plant traps, or uh, abandon their friends.`,
    hp: 7,
    itemNames: [
      'Training Sword'
    ]
  }
};

exports.getClasses = function () {
  // Custom comparators get out
  const classKeys = Object.keys(classes).sort();
  return classKeys.map(className => {
    let classObj = classes[className];
    return {
      name: classObj.name,
      selectText: `*${classObj.name}* - ${classObj.description}`,
      detailedDescription: classObj.detailedDescription
    };
  });
};

exports.getClass = function (name, playerId, displayName) {
  if (!playerId) {
    throw new Error(`Need to specify a player for this class!`);
  }
  let classDetails = classes[Util.convertName(name)];
  if (!classDetails) {
    throw new Error(`Class with name ${name} not found!`);
  }
  // See creatures.js
  let abilities = [];
  if (classDetails.abilityNames) {
    for (let i = 0; i < classDetails.abilityNames.length; i++) {
      abilities.push(Abilities.getAbility(classDetails.abilityNames[i]));
    }
  }

  let items = [];
  if (classDetails.itemNames) {
    for (let i = 0; i < classDetails.itemNames.length; i++) {
      let itemToEquip = Items.getItem(classDetails.itemNames[i]);
      itemToEquip.equipped = true;
      items.push(itemToEquip);
    }
  }

  let effects = [];
  if (classDetails.effects) {
    for (let i = 0; i < classDetails.effects.length; i++) {
      effects.push(Effects.getEffect(classDetails.effects[i]));
    }
  }

  let classToAdd = new Character(classDetails.name, displayName || classDetails.name, classDetails.description, 'PLAYER', classDetails.hp, classDetails.speed, null, abilities, items, effects);
  classToAdd.controller = playerId;
  classToAdd.items.forEach(item => {
    item.owner = classToAdd;
  });
  classToAdd.effects.forEach(effect => {
    effect.whoApplied = classToAdd;
  });
  return classToAdd;
};
