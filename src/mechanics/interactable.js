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
    this.logic = logic;
    this.required = required || {};
  }
};
