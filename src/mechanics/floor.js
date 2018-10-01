module.exports = class Floor {
  // No displayName or flavour because not user facing
  constructor (name, map, startingRoomLocation, floorAboveName, floorBelowName, onEnter) {
    this.name = name;
    this.map = map;
    this.startingRoomLocation = startingRoomLocation;
    this.floorAboveName = floorAboveName;
    this.floorBelowName = floorBelowName;
    this.onEnter = onEnter;
    this.visited = false;
  }
};
