module.exports = class Encounter {
  // For running events
  constructor (name, displayName, description, positions, effects, rewards) {
    this.name = name;
    this.displayName = displayName;
    this.description = description;
    this.positions = [];
    this.positions.push(positions.position1 || []);
    this.positions.push(positions.position2 || []);
    this.positions.push(positions.position3 || []);
    this.effects = effects || [[], [], [], [], [], []];
    this.rewards = rewards || [];
  }
};
