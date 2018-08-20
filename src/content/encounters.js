const Encounter = require('../mechanics/encounter.js');
const Creatures = require('../content/creatures.js');
const Effects = require('../mechanics/effects.js');
const Util = require('../util/util.js');

// Define all encounters

let encounters = {
  tutorial: {
    name: 'An Old Man',
    description: 'A short tutorial. Everyone\'s gotta start somewhere, right?',
    positions: {
      position3: [
        'Old Man'
      ]
    },
    effects: [
      // [],
      [Effects.getEffect('No Escape')],
      [],
      // [],
      [Effects.getEffect('Mystical Uphill')],
      [],
      [],
      []
    ]
  }
};

exports.getEncounter = function (name) {
  let encounterDetails = encounters[Util.convertName(name)];
  if (!encounterDetails) {
    throw new Error(`Encounter with name ${name} not found!`);
  }

  for (let pos in encounterDetails.positions) {
    for (let i = 0; i < encounterDetails.positions[pos].length; i++) {
      encounterDetails.positions[pos][i] = Creatures.getCreature(encounterDetails.positions[pos][i]);
    }
  }

  // Put rewards here when we decide how to do drops

  let encounterToAdd = new Encounter(encounterDetails.name, encounterDetails.description, encounterDetails.positions, encounterDetails.effects, encounterDetails.rewards);
  return encounterToAdd;
};
