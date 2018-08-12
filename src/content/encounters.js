const Encounter = require('../mechanics/encounter.js');
const Creatures = require('../content/creatures.js');
const Util = require('../util/util.js');

// Define all encounters

let encounters = {
  tutorial: {
    name: 'An Old Man',
    description: 'A short tutorial. Everyone\'s gotta start somewhere, right?',
    positions: {
      position3: [
        Creatures.getCreature('An Old Man')
      ]
    }
  }
};

exports.getEncounter = function (name) {
  let encounterDetails = encounters[Util.convertName(name)];
  if (!encounterDetails) {
    throw new Error(`Encounter with name ${name} not found!`);
  }
  let encounterToAdd = new Encounter(encounterDetails.name, encounterDetails.description, encounterDetails.positions, encounterDetails.effects, encounterDetails.rewards);
  return encounterToAdd;
};
