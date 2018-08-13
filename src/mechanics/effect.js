module.exports = class Effect {
  constructor (name, description, flavour, ticks, required, bindings) {
    this.name = name;
    this.description = description;
    this.flavour = flavour;
    this.ticks = ticks;

    this.currentTicks = null;
    this.whoApplied = null;
    this.turnApplied = null;

    this.required = required;
    for (let bind in bindings) {
      // should validate against list of valid effect bindings
      // maybe I should use the word bindings less
      if (!this[bind]) {
        this[bind] = bindings[bind];
      }
    }
  }
};
