module.exports = class Item {
  constructor (name, description, flavour, abilities, effects, onUse) {
    this.name = name;
    this.description = description;
    this.flavour = flavour;
    this.abilities = abilities || [];
    this.effects = effects || [];
    this.onUse = onUse;
  }

  getItemDetails () {
    let text = '**' + this.name + '**' + ' ' + this.description + '\n';
    text += '*' + this.name + ' abilities:* ';

    text += this.abilities.length === 0 ? '-' : '\n';

    this.abilities.forEach(ability => {
      text += ability.getAbilityDetails() + '\n';
    });
    if (this.effects.length !== 0) {
      text += '*' + this.name + 'effects:* \n';
      this.effects.forEach(effect => {
        text += effect.getEffectDetails() + '\n';
      });
    }

    return text.slice(0, -1);
  }
};
