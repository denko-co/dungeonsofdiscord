const Room = require('../mechanics/room.js');
const Creatures = require('./creatures.js');
const Interactables = require('./interactables.js');
const Util = require('../util/util.js');

// Rooms must have a build method, to create entities in the room and relate them
let rooms = {
  kikisCamp: {
    name: 'Kiki\'s Camp',
    showName: true,
    directions: {
      right: true
    },
    onEnter (worldManager) {
      if (this.visited) {
        worldManager.send('Camp entered.');
      } else {
        worldManager.send('Welcome to Camp Kiki!');
      }
    },
    onExit (worldManager) {
      worldManager.send('Camp exited.');
    },
    build () {
      const door = Interactables.getInteractable('Dungeon Door', {direction: 'right'});
      const lever = Interactables.getInteractable('Dungeon Lever', {door: door});
      return [Creatures.getCreature('Old Man'), door, lever];
    }
  },
  anEmptyRoom: {
    name: 'An Empty Room',
    directions: {},
    onEnter (worldManager) {
      worldManager.send('You should not be here!');
    },
    onExit (worldManager) {
      worldManager.send('How can you leave? There\'s no doors!');
    },
    build () { return []; }
  },
  aStub: {
    name: 'A Stub',
    directions: {
      left: true
    },
    onEnter (worldManager) {
      worldManager.send('Stub entered.');
    },
    onExit (worldManager) {
      worldManager.send('Stub exited.');
    },
    build () { return []; }
  }
};

exports.getRoom = function (name) {
  let roomDetails = rooms[Util.convertName(name)];
  if (!roomDetails) {
    throw new Error(`Room with name ${name} not found!`);
  }
  let roomToAdd = new Room(roomDetails.name, roomDetails.showName, roomDetails.directions, roomDetails.build(), roomDetails.onEnter, roomDetails.onExit);
  return roomToAdd;
};
