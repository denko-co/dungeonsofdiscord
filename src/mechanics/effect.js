const Util = require('../util/util.js');

module.exports = class Effect {
  constructor (name, description, flavour, ticks, required, bindings) {
    this.name = name;
    this.description = description;
    this.flavour = flavour;
    this.ticks = ticks;

    this.currentTicks = 0;
    this.whoApplied = null;

    this.required = required;
    for (let bind in bindings) {
      // should validate against list of valid effect bindings
      // maybe I should use the word bindings less
      if (!this[bind]) {
        this[bind] = bindings[bind];
      }
    }
  }

  getEffectDetails () {
    let text = '**' + this.name + '**' + ' ' + this.description + ' ';
    let info = '(';
    if (this.ticks === null) {
      info += 'permanent effect';
    } else {
      if (this.ticks === 0) {
        info += 'resolves immediately';
      } else {
        info += this.ticks + ' tick' + (this.ticks === 1 ? '' : 's');
        if (this.currentTicks === this.ticks) {
          info += ', expires at the end of this turn';
        } else {
          info += ', ' + this.currentTicks + ' tick' + (this.ticks - this.currentTicks === 1 ? '' : 's') + ' remaining';
        }
      }
    }
    if (this.whoApplied) {
      info += ', applied by ' + Util.getDisplayName(this.whoApplied);
    }
    info += ')';
    return text + info;
  }
};
