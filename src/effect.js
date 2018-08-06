module.exports = class Effect {
  constructor (name, description, bindings) {
    this.name = name;
    this.description = description;
    for (let bind in bindings) {
      // should validate against list of valid effect bindings
      // maybe I should use the word bindings less
      this[bind] = bindings[bind];
    }
  }
};
