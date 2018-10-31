const Util = require('../util/util.js');

module.exports = class Interactable {
  // No displayName or flavour because not user facing
  constructor (name, displayName, description, logic, required) {
    this.name = name;
    this.displayName = displayName;
    this.description = description;
    // Logic typically has the following for an interactable:
    // Some state stored in state
    // If you can use items, a list called interactionItems with names, and onInteract()
    // Some description of the interactable in onInspect()
    this.logic = Util.clone(logic);
    for (let logicEle in this.logic) {
      if (typeof this.logic[logicEle] === 'function') {
        this.logic[logicEle] = this.logic[logicEle].bind(this);
      }
    }
    this.required = required || {};
  }
};
