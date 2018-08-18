module.exports = class Item {
  constructor (name, description, flavour, uses, abilities, effects) {
    this.name = name;
    this.description = description;
    this.flavour = flavour;
    this.uses = uses;
    this.currentUses = 0;
    this.abilities = abilities || [];
    this.effects = effects || [];
  }

  getItemDetails () {
    let text = '**' + this.name + '**' + ' ' + this.description + ' ';
    let info = '';
    if (this.uses) info += this.currentUses + '/' + this.uses + 'uses';
    text += ' ' + (info === '' ? '' : '(' + info + ')') + '\n*' + this.name + ' abilities:* ';

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
