const Util = require('../util/util.js');

module.exports = class Item {
  constructor (name, displayName, description, flavour, icon, slot, abilities, effects, onUse) {
    this.name = name;
    this.displayName = displayName;
    this.description = description;
    this.flavour = flavour;
    this.icon = icon;
    this.slot = slot;
    this.abilities = abilities || [];
    this.effects = effects || [];
    this.onUse = Util.clone(onUse) || {};
    if (this.onUse.before) this.onUse.before = this.onUse.before.bind(this);
    if (this.onUse.after) this.onUse.after = this.onUse.after.bind(this);
    this.owner = null;
    this.equipped = false;
  }

  getItemDetails () {
    let text = this.icon + ' **' + this.displayName + '**' + ' ' + this.description + '\n';
    text += '*' + this.displayName + ' abilities:* ';

    text += this.abilities.length === 0 ? '-' : '\n';

    this.abilities.forEach(ability => {
      text += ability.getAbilityDetails() + '\n';
    });
    if (this.effects.length !== 0) {
      text += '*' + this.displayName + 'effects:* \n';
      this.effects.forEach(effect => {
        text += effect.getEffectDetails(this.owner) + '\n';
      });
    }

    return text.slice(0, -1);
  }
};
