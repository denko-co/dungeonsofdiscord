const Floor = require('../mechanics/floor.js');
const Rooms = require('./rooms.js');
const Util = require('../util/util.js');

let floors = {
  theOverUnder: {
    name: 'The Over Under',
    map: [
      ['Kiki\'s Camp', 'A Stub', 'An Empty Room']
    ],
    startingRoomLocation: [0, 0],
    onEnter (worldManager) {
      if (this.visited) {
        worldManager.send('Welcome to, wait, what?');
      } else {
        worldManager.send('Welcome to the game.');
      }
    },
    onExit (worldManager) {
      worldManager.send('Floor exited. Hmmm.');
    }
  }
};

exports.getFloor = function (name, requiredParams) {
  let floorDetails = floors[Util.convertName(name)];
  if (!floorDetails) {
    throw new Error(`Room with name ${name} not found!`);
  }
  let roomMap = floorDetails.map.map(row => row.map(row => Rooms.getRoom(row)));
  let floorToAdd = new Floor(floorDetails.name, roomMap, floorDetails.startingRoomLocation, floorDetails.floorAboveName, floorDetails.floorBelowName, floorDetails.onEnter);
  return floorToAdd;
};
