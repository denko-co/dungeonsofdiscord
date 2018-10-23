module.exports = class Room {
  // No displayName or flavour because not user facing
  constructor (name, showName, directions, entities, onEnter, onExit, onInspect) {
    this.name = name;
    this.showName = showName;
    this.directions = directions;
    this.entities = entities || [];
    this.onEnter = onEnter;
    this.onExit = onExit;
    this.visited = false;
  }
};
