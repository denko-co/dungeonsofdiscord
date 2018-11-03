module.exports = class Floor {
  // No displayName or flavour because not user facing
  constructor (name, map, startingRoomLocation, floorAboveName, floorBelowName, onEnter, onExit) {
    this.name = name;
    this.map = map;
    this.startingRoomLocation = startingRoomLocation;
    this.floorAboveName = floorAboveName;
    this.floorBelowName = floorBelowName;
    this.onEnter = onEnter ? onEnter.bind(this) : onEnter;
    this.onExit = onExit ? onExit.bind(this) : onExit;
    this.visited = false;
  }
};
