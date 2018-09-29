module.exports = class Floor {
  // No displayName or flavour because not user facing
  constructor (name, startingRoomLocation, map, floorAboveName, floorBelowName, onEnterFloor) {
    this.name = name;
    this.startingRoomLocation = startingRoomLocation;
    this.map = map;
    this.floorAboveName = floorAboveName;
    this.floorBelowName = floorBelowName;
    this.onEnterFloor = onEnterFloor;
    this.visited = false;
  }
};
