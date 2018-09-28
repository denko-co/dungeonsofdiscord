module.exports = class Item {
  constructor (name, displayName, description, flavour, abilities, effects, onUse) {
    this.name = name;
    this.displayName = displayName;
    this.description = description;
    this.flavour = flavour;
    this.abilities = abilities || [];
    this.effects = effects || [];
    this.onUse = onUse || {};
    this.owner = null;
  }

  getItemDetails () {
    let text = '**' + this.displayName + '**' + ' ' + this.description + '\n';
    text += '*' + this.displayName + ' abilities:* ';

    text += this.abilities.length === 0 ? '-' : '\n';

    this.abilities.forEach(ability => {
      text += ability.getAbilityDetails() + '\n';
    });
    if (this.effects.length !== 0) {
      text += '*' + this.displayName + 'effects:* \n';
      this.effects.forEach(effect => {
        text += effect.getEffectDetails() + '\n';
      });
    }

    return text.slice(0, -1);
  }
};
