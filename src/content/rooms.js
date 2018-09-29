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
      right: false
    },
    onEnter (gameManager) {
      if (this.visited) {
        gameManager.send('Welcome to Camp Kiki!');
      } else {
        gameManager.send('Camp entered.');
      }
    },
    onExit (gameManager) {
      gameManager.send('Camp exited.');
    },
    build () {
      const door = Interactables.getInteractable('Dungeon Door', {direction: 'right'});
      const lever = Interactables.getInteractable('Dungeon Door', {door: door});
      return [Creatures.getCreature('Old Man'), door, lever];
    }
  },
  anEmptyRoom: {
    name: 'An Empty Room',
    directions: {},
    onEnter (gameManager) {
      gameManager.send('You should not be here!');
    },
    onExit (gameManager) {
      gameManager.send('How can you leave? There\'s no doors!');
    },
    build () { return []; }
  },
  aStub: {
    name: 'A Stub',
    directions: {
      left: true
    },
    onEnter (gameManager) {
      gameManager.send('Stub entered.');
    },
    onExit (gameManager) {
      gameManager.send('Stub exited.');
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

  for (let roomFunct in roomToAdd) {
    if (typeof roomToAdd[roomFunct] === 'function') {
      roomToAdd[roomFunct] = roomToAdd[roomFunct].bind(roomToAdd);
    }
  }
  return roomToAdd;
};
