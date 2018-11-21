const Encounter = require('../mechanics/encounter.js');
const Creatures = require('./creatures.js');
const Effects = require('./effects.js');
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
      [Effects.getEffect('Cautious Cliffside')],
      [],
      [],
      []
    ]
  }
};

exports.getEncounter = function (name, displayName, entities) {
  let encounterDetails = encounters[Util.convertName(name)];
  if (!encounterDetails) {
    throw new Error(`Encounter with name ${name} not found!`);
  }

  let positionsCopy = Util.clone(encounterDetails.positions);

  for (let pos in positionsCopy) {
    for (let i = 0; i < positionsCopy[pos].length; i++) {
      let entity = null;
      if (entities) {
        for (let j = 0; j < entities.length; j++) {
          if (entities[j].name === positionsCopy[pos][i]) {
            entity = entities.slice(j, 1)[0];
            break;
          }
        }
      }
      positionsCopy[pos][i] = entity || Creatures.getCreature(positionsCopy[pos][i]);
    }
  }
  // Put rewards here when we decide how to do drops

  let encounterToAdd = new Encounter(encounterDetails.name, displayName || encounterDetails.name, encounterDetails.description, positionsCopy, encounterDetails.effects, encounterDetails.rewards);
  return encounterToAdd;
};
