const Util = require('../util/util.js');
const Abilities = require('../content/abilities.js');
const _ = require('underscore');

module.exports = class BattleManager {
  constructor (worldManager, players, encounter, battleTurnUser) {
    this.worldManager = worldManager;
    this.encounter = encounter;
    this.characterInFocus = null;
    this.actionsForPlayer = null;
    this.selectedAction = null;
    this.state = null;
    // Not used for temporary battles
    this.graveyard = [];
    this.fled = [];

    this.isTemporary = battleTurnUser !== undefined;
    if (this.isTemporary) {
      this.queue = [battleTurnUser];
      this.battlefield = players.slice().reverse(); // Want to operate on the raw players array
      this.battlefieldEffects = [[], [], []]; // :v)
    } else {
      this.queue = [];
      let playerCopy = players.map(arr => arr.slice());
      let enemyCopy = encounter.positions.map(arr => arr.slice());
      this.battlefield = playerCopy.reverse().concat(enemyCopy);
      this.battlefieldEffects = encounter.effects;
    }
    this.turn = 0;
  }

  initialise () {
    this.send(`\n*${Util.getBattleReadyText()}*`);
    this.send(Util.getVsText(this.encounter.displayName));
    this.send(`***${Util.getBattleStartText()}***\n`);
  }

  performTurn (reactionInfo) {
    // If this method returns true, the battle is complete
    // Will return 'CANCEL' if temporary and nothing happened
    if (!reactionInfo) {
      let effective = Util.getEffectiveCharacters(this.battlefield);
      // performTurn called not off an action, perform a game turn tick

      // Cleanup all effects for the turn just gone
      if (this.characterInFocus && !this.isTemporary) {
        this.worldManager.cleanupEffects(this.characterInFocus, effective.players
          .concat(effective.enemies)
          .concat(_.without(this.worldManager.getWorldEntities(), ...effective.enemies)), this);
      }
      if (this.isTemporary) {
        if (this.queue.length === 0) return true; // Person made their turn, delet this
      } else {
        if (effective.players.length === 0) {
          // All players are dead or fled! Oh no!
          this.send('The battle is over! Game over man, game over!');
          return true;
        } else if (effective.enemies.length === 0) {
          // All enemies are dead or fled! Hooray!
          this.send('The battle is over! You win!');
          return true;
        }

        if (this.queue.length === 0) {
          this.queue = Util.prepareQueue(effective.players, effective.enemies);

          // Take this opportunity to cleanup for dead and fled people
          [this.graveyard, this.fled].forEach(arr => {
            for (let i = 0; i < arr.length; i++) {
              this.worldManager.cleanupEffects(arr[i], effective.players
                .concat(effective.enemies)
                .concat(_.without(this.worldManager.getWorldEntities(), ...effective.enemies)), this);
            }
          });
          this.turn++;
        }
      }

      // Now we have a queue with something in it, we can pop and evaluate

      let character = this.queue.shift();
      this.characterInFocus = character;
      if (!this.isTemporary) this.send(Util.getDisplayName(character) + ', you\'re up!');
      if (character.controller) {
        // Hand to the player to do an action, give them options.
        let validActions = this.getValidActions(character);
        console.log('Battlefield on your turn is...');
        console.log(this.battlefield);
        this.actionsForPlayer = validActions;
        this.state = 'SELECT_ABILITY';

        this.send('What would you like to do?', this.getIconsForActions(validActions), true);
        return false;
      } else {
        // NPC, evaluate and tick (no interrupts).
        character.logic.performTurn(this); // I don't know anyone I am
        // Let's go again!
        return this.performTurn();
      }
    } else {
      if (this.characterInFocus && reactionInfo.user.id === this.characterInFocus.controller) {
        // Player has performed an action, check if it's good to go.
        let reactions = reactionInfo.message.reactions;
        switch (this.state) {
          case 'SELECT_ABILITY':
            if (reactionInfo.react === '📰') {
              this.send(this.getBattlefield(), ['🗑']);
              reactionInfo.messageReaction.remove(reactionInfo.user);
              return false;
            } else if (reactionInfo.react === 'ℹ') {
              let mapping = {
                '↔': 'gives you chances for moving positions, and lets you do so.',
                '🏳': 'gives you the chance to flee, and lets you do so. This is only available from position 1.',
                '🤷': 'passes your turn, if decisions are too difficult. This is like the out of combat option, but worse.',
                '⬅': 'swaps you to the out of battle context, i.e, the screen from before. This is not available in a real battle.',
                '🔄': 'allows you to equip and unequip items. Only equipped items can be used in battle.',
                '🎁': 'allows you to give an item from your inventory or hand to somebody else in your party.',
                '📰': 'shows you information about the current positions and effects of characters. This is also available in the player card.',
                'ℹ': 'shows you this, but you already knew that!'
              };
              let info = this.getIconsForActions(this.actionsForPlayer, true)
                .filter(icon => mapping[icon])
                .map(icon => icon + ' ' + mapping[icon]).join('\n');
              this.send('*Here are what the buttons do:*\n' + info + '\n\nAnything that is not here is an ability from an item or your skills.', ['🗑']);
              reactionInfo.messageReaction.remove(reactionInfo.user);
              return false;
            }
            if (reactionInfo.react !== '✅') return false; // Nothing to do!
            // Let's confirm their actions ...
            let options = Util.getSelectedOptions(reactions, this.getIconsForActions(this.actionsForPlayer, true), reactionInfo.user.id);
            if (options.length === 0) {
              // No option provided!
              this.send('Please select an ability to cast! To pass, press 🤷');
              reactionInfo.messageReaction.remove(reactionInfo.user);
            } else if (options.length > 1) {
              // Too many options provided!
              this.send('Too many choices! Only one pls!');
              reactionInfo.messageReaction.remove(reactionInfo.user);
            } else if (options[0] === '🤷') {
              // Player is passing, do nothing
              this.send('Passing? Are you sure? Alright then.');
              return this.performTurn();
            } else if (options[0] === '🏳') {
              // Player is running away
              let fleeInfo = this.getFleeChance(this.characterInFocus);
              // To hold chance
              this.selectedAction = fleeInfo;
              if (fleeInfo.chance === 0) {
                // Bounce back to action select
                this.send(fleeInfo.msg);
                return this.cancelAction('As you can\'t flee, your retreat');
              } else {
                this.send(fleeInfo.msg + 'Are you sure you want to run?', ['✅', '🚫'], true);
                this.state = 'CONFIRM_FLEE';
              }
            } else if (options[0] === '↔') {
              // Player is moving!
              let moveInfo = this.getMoveActions(this.characterInFocus);
              // Putting it into selected action, for now
              this.selectedAction = moveInfo;
              if (moveInfo.chance.left === 0 && moveInfo.chance.right === 0) {
                // Bounce back to action select
                this.send(moveInfo.msg);
                return this.cancelAction('As you can\'t move, movement');
              } else {
                this.send(moveInfo.msg + 'Where would you like to move?', moveInfo.icons, true);
                this.state = 'SELECT_MOVE';
              }
            } else if (options[0] === '🎁') {
              // Gifting! Giving? Choose an item first
              let chosen = this.getAbilityByIcon(this.actionsForPlayer, options[0]);
              this.selectedAction = chosen;
              let giftables = Util.getNumberedList(this.characterInFocus.items);
              this.send('What item would you like to give?\n' + giftables.msg, giftables.icons, true);
              this.state = 'SELECT_GIVE';
            } else if (options[0] === '🔄') {
              // Move to method to avoid long pasta if we need to bounce back.
              this.doSwapLogic();
              this.state = 'EQUIP_SELECT';
            } else if (options[0] === '⬅') {
              // They are cancelling, end this temp combat
              return 'CANCEL';
            } else {
              // Option selected, slam it
              let chosen = this.getAbilityByIcon(this.actionsForPlayer, options[0]);
              if (chosen.length) {
                // This icon matches mutiple items or abilities (usually will be 2 of the same item)
                let mapping = chosen.map(actionItem => actionItem.item
                  ? actionItem.item.getItemDetails()
                  : actionItem.ability.getAbilityDetails()
                );
                let matches = Util.getNumberedList(mapping);
                this.send('There are mutiple available actions with this icon. Which would you like to use? ' +
                'Note that some item abilities may not be available.\n' +
                  matches.msg, matches.icons, true);
                this.selectedAction = {choices: chosen, chosenList: matches};
                this.state = 'SELECT_ABILITY_CHOICE';
              } else {
                // > laughs in side effects
                this.doAbilitySelectLogic(chosen);
              }
            }
            return false;
          case 'SELECT_ABILITY_CHOICE':
            if (reactionInfo.react === '🚫') {
              // Bounce back to action select
              return this.cancelAction('Selection');
            } else if (reactionInfo.react === '✅') {
              let chosenAction = Util.getSelectedOptions(reactions, _.without(this.selectedAction.chosenList.icons, '🚫', '✅'), reactionInfo.user.id);
              if (chosenAction.length === 0) {
                this.send('Please select an item/ability.');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else if (chosenAction.length > 1) {
                this.send('Please select only one item/ability.');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else {
                let chosenIndex = Util.getEmojiNumbersAsInts(chosenAction);
                let chosen = this.selectedAction.choices[chosenIndex - 1];
                // Have an option, repeat the item or ability choice code
                this.doAbilitySelectLogic(chosen);
              }
            }
            return false;
          case 'EQUIP_SELECT':
            if (reactionInfo.react === '🚫') {
              // Bounce back to action select
              return this.cancelAction(this.selectedAction.equipping ? 'Equip' : 'Unequip');
            } else if (reactionInfo.react === '✅') {
              let equipSelect = Util.getSelectedOptions(reactions, _.without(this.selectedAction.itemList.icons, '🚫', '✅'), reactionInfo.user.id);
              if (equipSelect.length === 0) {
                this.send('Please select an option.');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else if (equipSelect.length > 1) {
                this.send('Please select only one option.');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else {
                let chosen = equipSelect[0];
                if (chosen === '➡' || chosen === '⬅') {
                  let opposite = chosen === '➡' ? '⬅' : '➡';
                  let equippedList = this.characterInFocus.items.filter(item =>
                    this.selectedAction.equipping ? item.equipped : !item.equipped);
                  let msg = chosen === '➡'
                    ? 'What item would you like to unequip? To swap out for an item in your inventory, press ⬅\n'
                    : 'Which item would you like to equip? To unequip an item without equipping a new one, press ➡\n';
                  let currentList = Util.getNumberedList(equippedList);
                  let tickIndex = currentList.icons.indexOf('✅');
                  currentList.icons.splice(tickIndex, 0, opposite);
                  this.selectedAction = {items: equippedList, itemList: currentList, equipping: chosen !== '➡'};
                  this.send(msg + currentList.msg, currentList.icons, true);
                } else {
                  let equipIndex = Util.getEmojiNumbersAsInts(equipSelect);
                  let equipItem = this.selectedAction.items[equipIndex - 1];
                  if (this.selectedAction.equipping) {
                    // What's in the slot?
                    let inSlot = this.characterInFocus.items.filter(item => item.equipped && item.slot !== 'extra' && (item.slot === equipItem.slot || (equipItem.slot === 'hand2' && item.slot === 'hand')));
                    if (inSlot.length === 0 || (inSlot.length === 1 && inSlot[0].slot === 'hand' && equipItem.slot === 'hand')) {
                      // Can equip without issue
                      equipItem.equipped = true;
                      this.send('*' + Util.getDisplayName(equipItem) + '* equipped!');
                      return this.performTurn();
                    } else {
                      this.selectedAction.item = equipItem;
                      this.selectedAction.itemsToChoose = {items: inSlot};
                      // Something will need to take the hit
                      if (equipItem.slot !== 'hand') {
                        // Dump hand
                        let toUnequip = '*' + Util.formattedList(Util.reduceList(inSlot.map(item => Util.getDisplayName(item)))) + '*';
                        this.send('To equip *' + Util.getDisplayName(equipItem) + '*, ' + toUnequip + ' must be unqeuipped. Are you sure?', ['✅', '🚫'], true);
                      } else {
                        // Choose one
                        let itemSelect = Util.getNumberedList(inSlot);
                        this.selectedAction.itemsToChoose.list = itemSelect;
                        this.send('Which items do you want to unequip?\n' + itemSelect.msg, itemSelect.icons, true);
                      }
                      this.state = 'EQUIP_SELECT_ITEM';
                    }
                  } else {
                    // Unequipping, doesn't require a second step.
                    equipItem.equipped = false;
                    this.send('*' + Util.getDisplayName(equipItem) + '* unequipped!');
                    return this.performTurn();
                  }
                }
              }
            }
            return false;
          case 'EQUIP_SELECT_ITEM':
            if (reactionInfo.react === '🚫') {
              // Gross! Have to go back to the very first item select.
              this.doSwapLogic('Unequip selection cancelled. ');
              this.state = 'EQUIP_SELECT';
            } else if (reactionInfo.react === '✅') {
              let equipItem = this.selectedAction.item;
              if (this.selectedAction.itemsToChoose.list) {
                // Figure out which ones are getting the boot
                let iTC = this.selectedAction.itemsToChoose;
                let selectedItems = Util.getSelectedOptions(reactions, _.without(iTC.list.icons, '🚫', '✅'), reactionInfo.user.id);
                if (selectedItems.length === 0) {
                  this.send('Please at least one item to stash.');
                  reactionInfo.messageReaction.remove(reactionInfo.user);
                  return false;
                } else {
                  this.selectedAction.itemsToChoose.items = Util.getEmojiNumbersAsInts(selectedItems).map(index => iTC.items[index - 1]);
                }
                // Let it fall through, have the correct items now
              }
              // Slam it
              let itemsToUnequip = '*' + Util.formattedList(Util.reduceList(this.selectedAction.itemsToChoose.items.map(item => Util.getDisplayName(item)))) + '*';
              this.selectedAction.itemsToChoose.items.forEach(item => { item.equipped = false; });
              equipItem.equipped = true;
              this.send('*' + Util.getDisplayName(equipItem) + '* equipped, and ' + itemsToUnequip + ' unequipped!');
              return this.performTurn();
            }
            return false;
          case 'SELECT_ITEM_ABILITY':
            if (reactionInfo.react === '🚫') {
              // Bounce back to action select
              return this.cancelAction('Ability selection cancelled');
            } else if (reactionInfo.react === '✅') {
              // Ability picked, you know the drill.
              let abilities = Util.getSelectedOptions(reactions, this.selectedAction.abilitiesText.icons, reactionInfo.user.id);
              if (abilities.length === 0) {
                this.send('Please select an item ability.');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else if (abilities.length > 1) {
                this.send('Please select only one item abilit - that\'s not how this works!');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else {
                // Got it, pick it
                let abilityObj = this.selectedAction.abilities.find(abilObj => abilObj.ability.icon === abilities[0]);
                this.selectedAction.ability = abilityObj.ability;
                this.selectedAction.targets = abilityObj.targets;
                // Target code repeat
                let targets = Util.getNumberedList(abilityObj.targets);
                this.send('Please choose ' + abilityObj.ability.targets.number + ' target' + (abilityObj.ability.targets.number === 1 ? '' : 's') + ' from the following.\n' + targets.msg, targets.icons, true);
                this.state = 'SELECT_TARGET';
              }
            }
            return false;
          case 'SELECT_TARGET':
            if (reactionInfo.react === '🚫') {
              if (this.selectedAction.item) {
                // Bounce back to ability selection
                let abilityOptions = Util.getNumberedList(this.selectedAction.abilities.map(abilObj => abilObj.ability));
                this.send('Targeting cancelled. What ability would you like to use?\n' + abilityOptions.msg, abilityOptions.icons, true);
                this.state = 'SELECT_ITEM_ABILITY';
                return false;
              } else {
                // Bounce back to action select
                return this.cancelAction('Targeting');
              }
            } else if (reactionInfo.react === '✅') {
              // Let's go get the targets...
              let targets = Util.getSelectedOptions(reactions, Util.getNumberedList(this.selectedAction.targets, true).icons, reactionInfo.user.id);
              targets = Util.getEmojiNumbersAsInts(targets);
              if (targets.length > this.selectedAction.ability.targets.number || targets.length === 0) {
                // Not enough / too many targets
                this.send('Pls select a valid number of targets (at least 1).');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else {
                // Gogogogogo!
                let targetChars = targets.map(pos => {
                  return this.selectedAction.targets[pos - 1];
                });

                let item = this.selectedAction.item;
                let ability = this.selectedAction.ability;
                if (item && item.onUse.before) {
                  item.onUse.before(ability, this);
                }

                this.useAbility(ability, this.characterInFocus, targetChars, item);

                if (item && item.onUse.after) {
                  item.onUse.after(ability, this);
                }
                // Turn over, move onto next person.
                return this.performTurn();
              }
              return false;
            } else {
              return false; // Nothing to do!
            }
          case 'SELECT_MOVE':
            if (reactionInfo.react === '🚫') {
              // Bounce back to action select
              return this.cancelAction('Movement');
            } else if (reactionInfo.react === '✅') {
              // Which way are you going?
              let directions = Util.getSelectedOptions(reactions, _.without(this.selectedAction.icons, '🚫', '✅'), reactionInfo.user.id);
              if (directions.length > 1) {
                // Trying to move two ways at once
                this.send('If you move in many directions at once, do you really move anywhere? Maybe, I failed my physics class.');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else if (directions.length === 0) {
                // Nothing selected
                this.send('Please choose a direction to move in.');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else {
                // Attempt a move, do the next turn
                this.performMove(this.characterInFocus, directions[0], this.selectedAction.chance);
                return this.performTurn();
              }
              return false;
            } else {
              return false; // Nothing to do!
            }
          case 'CONFIRM_FLEE':
            if (reactionInfo.react === '🚫') {
              // Bounce back to action select
              return this.cancelAction('Retreat');
            } else if (reactionInfo.react === '✅') {
              // Running away!
              this.performFlee(this.characterInFocus, this.selectedAction.chance);
              return this.performTurn();
            } else {
              return false; // Nothing to do!
            }
          case 'SELECT_GIVE':
            if (reactionInfo.react === '🚫') {
              this.cancelAction('Giving');
            } else if (reactionInfo.react === '✅') {
              let giftables = Util.getNumberedList(this.characterInFocus.items, true);
              giftables = Util.getSelectedOptions(reactions, giftables.icons, reactionInfo.user.id);
              if (giftables.length === 0) {
                this.send('Please select an item to give.');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else if (giftables.length > 1) {
                this.send('So generous! But please, one at a time.');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else {
                let giftIndex = Util.getEmojiNumbersAsInts(giftables);
                let gift = this.characterInFocus.items[giftIndex - 1];
                this.selectedAction.item = gift;
                // Give them choice on who to gift
                let alliesList = Util.getNumberedList(this.selectedAction.targets);
                this.send('Who would you like to give *' + Util.getDisplayName(gift) + '*?\n' + alliesList.msg, alliesList.icons, true);
                this.state = 'SELECT_GIVE_TARGET';
              }
            }
            return false;
          case 'SELECT_GIVE_TARGET':
            if (reactionInfo.react === '🚫') {
              // Copy pasta of the gift code
              let giftables = Util.getNumberedList(this.selectedAction.items);
              this.send('What item would you like to give?\n' + giftables.msg, giftables.icons, true);
              this.state = 'SELECT_GIVE';
            } else if (reactionInfo.react === '✅') {
              // :thinking:
              let personsToGift = Util.getSelectedOptions(reactions, Util.getNumberedList(this.selectedAction.targets, true).icons, reactionInfo.user.id);
              if (personsToGift.length === 0) {
                this.send('Please select a person to gift.');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else if (personsToGift.length > 1) {
                this.send('Please select only one person - what are they gonna do, cut it up? Shared custody?');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else {
                // Figure out person and item index
                let personToGiftIndex = Util.getEmojiNumbersAsInts(personsToGift);
                let personToGift = this.selectedAction.targets[personToGiftIndex - 1];

                // Give item to person
                personToGift.items.push(this.selectedAction.item);
                this.selectedAction.item.equipped = false;
                this.selectedAction.item.owner = personToGift;

                // Take it away from the owner ;(
                let giftIndex = this.characterInFocus.items.indexOf(this.selectedAction.item);
                this.characterInFocus.items.splice(giftIndex, 1);

                this.send('Transfer complete! Enjoy your loot.');
                return this.performTurn();
              }
            }
            return false;
        }
      } else {
        return false; // Even less to do!
      }
    }
  }

  doAbilitySelectLogic (chosen) {
    this.selectedAction = chosen;
    // If there is an item, check if there is mutiple abilities
    if (this.selectedAction.item) {
      let abilityMap = this.selectedAction.abilities.map(abilObj => abilObj.ability);
      let abilityIcons = abilityMap.map(ability => ability.icon);
      let abilityMsg = abilityMap.map(ability => ability.getAbilityDetails()).join('\n');
      this.selectedAction.abilitiesText = {icons: abilityIcons, msg: abilityMsg};
      let iconsToSend = abilityIcons.slice();
      iconsToSend.push('✅', '🚫');
      this.send('What ability would you like to use?\n' + abilityMsg, iconsToSend, true);
      this.state = 'SELECT_ITEM_ABILITY';
    } else {
      // Just an ability, jump through to target code
      let targets = Util.getNumberedList(this.selectedAction.targets);
      this.send('Please choose ' + this.selectedAction.ability.targets.number + ' target' + (this.selectedAction.ability.targets.number === 1 ? '' : 's') + ' from the following.\n' + targets.msg, targets.icons, true);
      this.state = 'SELECT_TARGET';
    }
  }

  doSwapLogic (additonalMsg) {
    // Attempting to swap items
    let current = this.characterInFocus.items.filter(item => !item.equipped);
    let equippedList = this.characterInFocus.items.filter(item => item.equipped);
    let msg;
    let equipping = true;
    if (current.length === 0) {
      current = equippedList;
      msg = 'Which item would you like to unequip?\n';
      equipping = false;
    } else {
      msg = 'Which item would you like to equip?';
      if (equippedList.length > 0) {
        msg += ' To unequip an item without equipping a new one, press ➡';
      }
      msg += '\n';
    }
    let currentList = Util.getNumberedList(current);
    if (equipping && equippedList.length > 0) {
      let tickIndex = currentList.icons.indexOf('✅');
      currentList.icons.splice(tickIndex, 0, '➡');
    }
    this.selectedAction = {items: current, itemList: currentList, equipping: equipping};
    this.send((additonalMsg || '') + msg + currentList.msg, currentList.icons, true);
    this.state = 'EQUIP_SELECT';
  }

  getAbilityByIcon (actions, icon) {
    let abils = actions.items.filter(itemObj => itemObj.item.icon === icon)
      .concat(actions.abilities.filter(abilObj => abilObj.ability.icon === icon));
    return abils.length === 1 ? abils[0] : abils;
  }

  getIconsForActions (actions, onlyIcons) {
    let icons = _.uniq(actions.items.map(itemObj => itemObj.item.icon)
      .concat(actions.abilities.map(abilObj => abilObj.ability.icon)));

    if (!onlyIcons) {
      icons.push('✅');
    }
    return icons;
  }

  getFleeChance (char) {
    let msg = '';
    let fleeEffects = char.getListeningEffects(this, 'onFleeAttempt');
    let fleeEffectNames = fleeEffects.map(ele => ele.displayName);
    let chance = fleeEffects.reduce((currentChance, ele) => {
      return currentChance * ele.onFleeAttempt(char, this);
    }, 1);
    if (chance === 0) {
      msg += `Some effects have been applied and have reduced your chance to flee to 0%`;
    } else {
      msg += `Chance to flee: ${chance * 100}%`;
    }
    if (fleeEffectNames.length !== 0) {
      msg += `\nEffects applied: *${Util.formattedList(fleeEffectNames)}*`;
    }
    msg += '\n';
    return {msg: msg, chance: chance};
  }

  getMoveActions (char, onlyIcons) {
    let position = this.getCharacterLocation(char).arrayPosition;
    let msg = '';
    let icons = [];
    // Check if able to move
    let moveLeftEffects = char.getListeningEffects(this, 'onMoveBackwardAttempt');
    let moveLeftDetails = {
      effectsTriggered: moveLeftEffects.map(ele => ele.displayName),
      chance: moveLeftEffects.reduce((currentChance, ele) => {
        return currentChance * ele.onMoveBackwardAttempt(char, this);
      }, 1),
      text: 'left',
      position: 0,
      tempPosition: 0,
      direction: 'back',
      icon: '⬅'
    };
    let moveRightEffects = char.getListeningEffects(this, 'onMoveForwardAttempt');
    let moveRightDetails = {
      effectsTriggered: moveRightEffects.map(ele => ele.displayName),
      chance: moveRightEffects.reduce((currentChance, ele) => {
        return currentChance * ele.onMoveForwardAttempt(char, this);
      }, 1),
      text: 'right',
      position: 5,
      tempPosition: 2,
      direction: 'forward',
      icon: '➡'
    };

    // Build message response
    [moveLeftDetails, moveRightDetails].forEach(direction => {
      if (position === (this.isTemporary ? direction.tempPosition : direction.position)) {
        // Can't move further
        msg += `You are as far ${direction.direction} as possible, and can't move further to the ${direction.text}.`;
        direction.chance = 0;
      } else {
        if (direction.chance === 0) {
          msg += `Some effects have been applied and have reduced your chance to move ${direction.text} to 0%`;
        } else {
          msg += `Chance to move ${direction.text}: ${direction.chance * 100}%`;
        }
        if (direction.effectsTriggered.length !== 0) {
          let effectList = direction.effectsTriggered;
          let effectString = Util.formattedList(effectList);
          msg += `\nEffects applied: ${effectString}`;
        }
      }
      msg += '\n';
      if (direction.chance !== 0) {
        icons.push(direction.icon);
      }
    });
    if (!onlyIcons) {
      icons.push('✅', '🚫');
    }
    return {msg: msg, icons: icons, chance: {left: moveLeftDetails.chance, right: moveRightDetails.chance}};
  }

  getValidActions (char) {
    let actions = {
      items: [],
      abilities: []
    };
    char.items.filter(item => item.equipped).forEach(item => {
      let itemObject = null;
      item.abilities.forEach(ability => {
        // Check if the ability can target something. If it's not null, add it to the pool
        let targets = this.getValidTargets(char, ability);
        if (targets && targets.length !== 0) {
          let abilityObj = {
            ability: ability,
            targets: targets
          };
          if (itemObject) {
            itemObject.abilities.push(abilityObj);
          } else {
            itemObject = {item: item, abilities: [abilityObj]};
          }
        }
      });
      if (itemObject) actions.items.push(itemObject);
    });

    char.abilities.forEach(ability => {
      // As before for item abilities
      let targets = this.getValidTargets(char, ability);
      if (targets && targets.length !== 0) {
        actions.abilities.push({ability: ability, targets: targets});
      }
    });

    // Can always move (might be blocked by effects but in premise)
    actions.abilities.push({ability: Abilities.getAbility('Move'), targets: null});
    // Can only run away if in position 1, or position 6 for enemies (and even then...) AND we're in a real fight
    let charPos = this.getCharacterLocation(char).arrayPosition;
    if (((charPos === 0 && char.controller) || (charPos === 5 && !char.controller)) && !this.isTemporary) {
      actions.abilities.push({ability: Abilities.getAbility('Flee'), targets: null});
    }

    // If there's a char provided and they have loot, let them give stuff
    if (char.items.length > 0) {
      actions.abilities.push({ability: Abilities.getAbility('Equip'), targets: null});
      let giveAbility = Abilities.getAbility('Give');
      let targets = this.getValidTargets(char, giveAbility);
      if (targets && targets.length !== 0) {
        actions.abilities.push({ability: Abilities.getAbility('Give'), targets: targets});
      }
    }

    // Can always pass
    actions.abilities.push({ability: Abilities.getAbility('Pass'), targets: null});

    // Can always display combat info (can also do this from char card)
    actions.abilities.push({ability: Abilities.getAbility('Battle'), targets: null});

    // Can always ask for info
    actions.abilities.push({ability: Abilities.getAbility('Info'), targets: null});

    // If this is not a real combat, give them a chance to opt out
    if (this.isTemporary) actions.abilities.push({ability: Abilities.getAbility('Return'), targets: null});

    return actions;
  }

  getValidTargets (char, ability) {
    if (ability.targets.number === 0) {
      // battlefield effect, return null
      return null;
    } else if (ability.targets.type === 'SELF') {
      return [char];
    } else {
      let targets = [];
      // look for people IN RANGE to target
      let position = this.getCharacterLocation(char).arrayPosition;
      for (let i = position - ability.range; i <= position + ability.range; i++) {
        if (i >= 0 && i < this.battlefield.length) {
          // range is on battlefield, collect chars
          this.battlefield[i].forEach(battlefieldchar => {
            if (
              (battlefieldchar.controller && ability.targets.type !== 'ENEMY') ||
                (!battlefieldchar.controller && ability.targets.type !== 'ALLY')
            ) {
              targets.push(battlefieldchar);
            }
          });
        }
      }
      return targets;
    }
  }

  getCharacterLocation (char) {
    for (let i = 0; i < this.battlefield.length; i++) {
      for (let j = 0; j < this.battlefield[i].length; j++) {
        // 'Member nested for loops? There's probably a more js way of doing this ...
        if (this.battlefield[i][j] === char) {
          return {arrayPosition: i, arraySubposition: j};
        }
      }
    }
    // throw new Error('Character not found! Uh oh!');
    return null;
  }

  removeFromBattle (char, reason) {
    // Remove from queue (if they are in there)
    let queuePos = this.queue.indexOf(char);
    if (queuePos > -1) {
      this.queue.splice(queuePos, 1);
    }
    // Remove from battlefield if this is not a fake battle
    if (!this.isTemporary) {
      let location = this.getCharacterLocation(char);
      this.battlefield[location.arrayPosition].splice(location.arraySubposition, 1);
      switch (reason) {
        case 'DEAD':
          this.graveyard.push(char);
          break;
        case 'FLED':
          this.fled.push(char);
          break;
      }
    }
  }

  performFlee (char, fleeChance) {
    if (Math.random() <= fleeChance) {
      // Hooray!
      this.send(Util.getDisplayName(char) + ' has fled the battle!');
      this.removeFromBattle(char, 'FLED');
    } else {
      // ;~;
      this.send(Util.getDisplayName(char) + ' has failed their escape. Stand and deliver!');
    }
  }

  performMove (char, directionIcon, moveChance) {
    let direction = (directionIcon === '⬅' ? 'left' : 'right');
    let successChance = moveChance[direction];
    if (Math.random() <= successChance) {
      // Hooray!
      let newPos = this.movePlayer(char, direction);
      this.send('Successfully moved to position ' + newPos + '!');
    } else {
      // ;~;
      this.send('Despite your best effort, your legs fail you.');
    }
  }

  movePlayer (char, direction) {
    let location = this.getCharacterLocation(char);
    let directionOffset = direction === 'left' ? -1 : 1;
    this.battlefield[location.arrayPosition].splice(location.arraySubposition, 1);
    this.battlefield[location.arrayPosition + directionOffset].push(char);
    return location.arrayPosition + directionOffset + 1;
  }

  cancelAction (actionText) {
    // Bounce back to action select
    this.send(`${actionText} has been cancelled. What would you like to do?`, this.getIconsForActions(this.actionsForPlayer), true);
    this.state = 'SELECT_ABILITY';
    return false;
  }

  useAbility (ability, caster, targets, item) {
    let effect = Util.clone(ability.effect); // Take copy
    effect.whoApplied = caster;
    if (ability.targets.number === 0) {
      // Battlefield effect, oBA handles the placement (battleManager still does cleanup ? )
      if (effect.onBattlefieldApply) {
        effect.onBattlefieldApply(this, caster, targets, ability, item);
      }
      targets.forEach(target => {
        this.battlefieldEffects[target].push(effect);
      });
    } else {
      // cast skill, use on each target
      for (let i = 0; i < targets.length; i++) {
        let target = targets[i];
        if (effect.onApply) {
          effect.onApply(this, caster, target, ability, item);
        }
        if (!target.alive) {
          this.send(Util.getDisplayName(target) + ' has been slain!');
          this.removeFromBattle(target, 'DEAD');
        } else {
          target.effects.push(effect);
        }
      }
      // check if caster survived the ordeal (and we haven't death checked them yet)
      if (!targets.includes(caster) && !caster.alive) {
        this.send(Util.getDisplayName(caster) + ' has been slain!');
        this.removeFromBattle(caster, 'DEAD');
      }
    }
    // Now that we have used the ability, bump its uses
    ability.uses.game++;
    ability.uses.battle++;
  }

  getBattlefield () {
    let battle = this.battlefield;
    let dead = this.graveyard;
    let fled = this.fled;
    let bfEffects = this.battlefieldEffects;
    let text = '';
    let no = '-';
    for (let i = 0; i < battle.length; i++) {
      text += '***Position ' + (i + 1) + ':*** ';
      if (battle[i].length === 0) text += no;
      for (let j = 0; j < battle[i].length; j++) {
        let char = battle[i][j];
        text += (j === 0 ? '' : ', ') + Util.getDisplayName(char) + ' @ ' + char.currenthp + '/' + char.hp + ' hp';
      }
      text += '\n';
      if (bfEffects[i].length !== 0) {
        text += '*Battlefield effects:*\n';
        bfEffects[i].forEach(effect => {
          text += effect.getEffectDetails() + '\n';
        });
      }
    }
    if (!this.isTemporary) {
      [dead, fled].forEach(arr => {
        text += (arr === dead ? '*Graveyard:* ' : '*Fled:* ');
        if (arr.length === 0) text += no;
        else {
          let people = arr.map(char => Util.getDisplayName(char));
          text += Util.capitalise(Util.formattedList(Util.reduceList(people)));
        }
        text += '\n';
      });
    }
    return text;
  }

  send (message, reactions, saveId) {
    this.worldManager.send(message, reactions, saveId);
  }
};
