module.exports = class Floor {
  // No displayName or flavour because not user facing
  constructor (name, map, startingRoomLocation, floorAboveName, floorBelowName, onEnterFloor) {
    this.name = name;
    this.map = map;
    this.startingRoomLocation = startingRoomLocation;
    this.floorAboveName = floorAboveName;
    this.floorBelowName = floorBelowName;
    this.onEnterFloor = onEnterFloor;
    this.visited = false;
  }
};
