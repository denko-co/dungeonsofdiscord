const Util = require('../util/util.js');
const Abilities = require('../mechanics/abilities.js');
const _ = require('underscore');

module.exports = class BattleManager {
  constructor (gamemanager, encounter) {
    this.gamemanager = gamemanager;
    this.encounter = encounter;
    this.characterInFocus = null;
    this.actionsForPlayer = null;
    this.selectedAction = null;
    this.state = null;
    this.queue = [];
    this.graveyard = [];
    this.fled = [];
    this.battlefield = gamemanager.players.reverse().concat(encounter.positions);
    this.battlefieldEffects = encounter.effects;
    this.turn = 0;
  }

  async initialise () {
    await this.send(`*${Util.getBattleReadyText()}*`);
    await this.send(Util.getVsText(this.encounter.name));
    await this.send(`***${Util.getBattleStartText()}***`);
    return this.performTurn();
  }

  async performTurn (reactionInfo) {
    if (!reactionInfo) {
      let effective = Util.getEffectiveCharacters(this.battlefield);
      // performTurn called not off an action, perform a game turn tick

      if (effective.players.length === 0) {
        // All players are dead or fled! Oh no!
        this.send('The battle is over! Game over man, game over!');
        return 'EXPLORING';
      } else if (effective.enemies.length === 0) {
        // All enemies are dead or fled! Hooray!
        this.send('The battle is over! You win!');
        return 'EXPLORING';
      }

      // Cleanup all effects for the turn just gone
      if (this.characterInFocus) {
        await this.cleanupEffects(this.characterInFocus, effective.players.concat(effective.enemies));
      }

      if (this.queue.length === 0) {
        this.queue = this.prepareQueue(effective.players, effective.enemies);

        // Take this opportunity to cleanup for dead/fled people
        for (let i = 0; i < this.graveyard.length; i++) {
          await this.cleanupEffects(this.graveyard[i], effective.players.concat(effective.enemies));
        }
        this.turn++;
      }

      // Now we have a queue with something in it, we can pop and evaluate

      let character = this.queue.shift();
      this.characterInFocus = character;
      await this.send(Util.getDisplayName(character) + ', you\'re up!');
      if (character.owner) {
        // Hand to the player to do an action, give them options.
        let validActions = this.getValidActions(character);
        console.log('Battlefield on your turn is...');
        console.log(this.battlefield);
        this.actionsForPlayer = validActions;
        this.state = 'SELECT_ABILITY';

        let questionToAsk = await this.send('What would you like to do?', true);
        Util.addReactions(questionToAsk, this.getIconsForActions(validActions));
        return 'BATTLING';
      } else {
        // NPC, evaluate and tick (no interrupts).
        await character.logic.performTurn(this, character); // I don't know anyone I am
        // Let's go again!
        return this.performTurn();
      }
    } else {
      if (this.characterInFocus && reactionInfo.user.id === this.characterInFocus.owner) {
        // Player has performed an action, check if it's good to go.
        let reactions = reactionInfo.message.reactions;
        switch (this.state) {
          case 'SELECT_ABILITY':
            if (reactionInfo.react !== '✅') return 'BATTLING'; // Nothing to do!
            // Let's confirm their actions ...
            let options = this.getSelectedOptions(reactions, this.getIconsForActions(this.actionsForPlayer, true), reactionInfo.user.id);
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
              let fleeInfo = await this.getFleeChance(this.characterInFocus);
              // To hold chance
              this.selectedAction = fleeInfo;
              if (fleeInfo.chance === 0) {
                // Bounce back to action select
                await this.send(fleeInfo.msg);
                return this.cancelAction('As you can\'t flee, your retreat');
              } else {
                let fleeMessage = await this.send(fleeInfo.msg + 'Are you sure you want to run?', true);
                Util.addReactions(fleeMessage, ['✅', '🚫']);
                this.state = 'CONFIRM_FLEE';
              }
            } else if (options[0] === '↔') {
              // Player is moving!
              let moveInfo = await this.getMoveActions(this.characterInFocus);
              // Putting it into selected action, for now
              this.selectedAction = moveInfo;
              if (moveInfo.chance.left === 0 && moveInfo.chance.right === 0) {
                // Bounce back to action select
                await this.send(moveInfo.msg);
                return this.cancelAction('As you can\'t move, movement');
              } else {
                let moveMessage = await this.send(moveInfo.msg + 'Where would you like to move?', true);
                Util.addReactions(moveMessage, moveInfo.icons);
                this.state = 'SELECT_MOVE';
              }
            } else {
              // Option selected, slam it
              let chosen = this.getAbilityByIcon(this.actionsForPlayer, options[0]);
              this.selectedAction = chosen;
              let targets = this.getTargetList(chosen.targets);
              let questionToAsk = await this.send('Please choose ' + chosen.action.targets.number + ' target' + (chosen.action.targets.number === 1 ? '' : 's') + ' from the following.\n' + targets.msg, true);
              Util.addReactions(questionToAsk, targets.icons);
              this.state = 'SELECT_TARGET';
            }
            return 'BATTLING';
          case 'SELECT_TARGET':
            if (reactionInfo.react === '🚫') {
              // Bounce back to action select
              return this.cancelAction('Targeting');
            } else if (reactionInfo.react === '✅') {
              // Let's go get the targets...
              let targets = this.getSelectedOptions(reactions, this.getTargetList(this.selectedAction.targets, true).icons, reactionInfo.user.id);
              targets = Util.getEmojiNumbersAsInts(targets);
              if (targets.length !== this.selectedAction.action.targets.number) {
                // Not enough / too many targets
                this.send('Pls select the correct number of targets.');
                reactionInfo.messageReaction.remove(reactionInfo.user);
              } else {
                // Gogogogogo!
                let targetChars = targets.map(pos => {
                  return this.selectedAction.targets[pos - 1];
                });

                await this.useAbility(this.selectedAction.action, this.characterInFocus, targetChars);

                // Turn over, move onto next person.
                return this.performTurn();
              }
              return 'BATTLING';
            } else {
              return 'BATTLING'; // Nothing to do!
            }
          case 'SELECT_MOVE':
            if (reactionInfo.react === '🚫') {
              // Bounce back to action select
              return this.cancelAction('Movement');
            } else if (reactionInfo.react === '✅') {
              // Which way are you going?
              let directions = this.getSelectedOptions(reactions, _.without(this.selectedAction.icons, '🚫', '✅'), reactionInfo.user.id);
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
                await this.performMove(this.characterInFocus, directions[0], this.selectedAction.chance);
                return this.performTurn();
              }
              return 'BATTLING';
            } else {
              return 'BATTLING'; // Nothing to do!
            }
          case 'CONFIRM_FLEE':
            if (reactionInfo.react === '🚫') {
              // Bounce back to action select
              return this.cancelAction('Retreat');
            } else if (reactionInfo.react === '✅') {
              // Running away!
              await this.performFlee(this.characterInFocus, this.selectedAction.chance);
              return this.performTurn();
            } else {
              return 'BATTLING'; // Nothing to do!
            }
        }
      }
    }
  }

  getSelectedOptions (reactions, validIcons, userId) {
    let options = [];
    reactions.forEach((react, icon) => {
      if (validIcons.includes(icon)) {
        react.users.forEach(user => {
          if (user.id === userId) {
            options.push(icon);
          }
        });
      }
    });
    return options;
  }

  prepareQueue (players, enemies) {
    let slow = [];
    let normal = [];
    let fast = [];
    let arrays = [players, enemies];
    arrays.forEach(arr => {
      arr.forEach(character => {
        let arr;
        switch (character.speed) {
          case 'FAST':
            arr = fast;
            break;
          case 'NORMAL':
            arr = normal;
            break;
          case 'SLOW':
            arr = slow;
            break;
          default:
            throw new Error('Unrecognised speed! Uh oh!');
        }
        arr.push(character);
      });
    });
    let queue = (_.shuffle(fast)).concat(_.shuffle(normal)).concat(_.shuffle(slow));
    return queue;
  }

  getAbilityByIcon (actionList, icon) {
    return actionList.find(actionItem => {
      return actionItem.action.icon === icon;
    });
  }

  getIconsForActions (actionList, onlyIcons) {
    let icons = actionList.map(actionItem => {
      return actionItem.action.icon;
    });
    if (!onlyIcons) {
      icons.push('✅');
    }
    return icons;
  }

  getTargetList (targetList, onlyIcons) {
    let numbers = Util.getNumbersAsEmoji();
    let targetString = '';
    for (let i = 0; i < targetList.length; i++) {
      targetString += numbers[i] + ' - ' + Util.getDisplayName(targetList[i]) + '\n';
    }
    let targetIcons = numbers.slice(0, targetList.length);
    if (!onlyIcons) {
      targetIcons.push('✅', '🚫');
    }
    return {msg: targetString, icons: targetIcons};
  }

  async getFleeChance (char) {
    let msg = '';
    let fleeChance = await char.iterateEffects('FLEE', this, true);
    if (fleeChance.chance === 0) {
      msg += `Some effects have been applied and have reduced your chance to flee to 0%`;
    } else {
      msg += `Chance to flee: ${fleeChance.chance * 100}%`;
    }
    if (fleeChance.effectsTriggered.length !== 0) {
      let effectList = fleeChance.effectsTriggered;
      let effectString = Util.formattedList(effectList);
      msg += `\nEffects applied: *${effectString}*`;
    }
    msg += '\n';
    return {msg: msg, chance: fleeChance.chance};
  }

  async getMoveActions (char, onlyIcons) {
    let position = this.getCharacterLocation(char).arrayPosition;
    let msg = '';
    let icons = [];
    // Check if able to move
    let moveLeftDetails = await char.iterateEffects('MOVE_BACKWARD', this, true);
    _.extend(moveLeftDetails, {
      text: 'left',
      position: 0,
      direction: 'back',
      icon: '⬅'
    });
    let moveRightDetails = await char.iterateEffects('MOVE_FORWARD', this, true);
    _.extend(moveRightDetails, {
      text: 'right',
      position: 5,
      direction: 'forward',
      icon: '➡'
    });

    // Build message response
    [moveLeftDetails, moveRightDetails].forEach(direction => {
      if (position === direction.position) {
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
    let actionList = [];
    let abilitiesToCheck = char.abilities;

    char.items.forEach(item => {
      abilitiesToCheck = abilitiesToCheck.concat(item.abilities);
    });

    abilitiesToCheck.forEach(ability => {
      // Check if the ability can target something. If it's not null, add it to the pool
      let targets = this.getValidTargets(char, ability);
      if (targets && targets.length !== 0) {
        actionList.push({action: ability, targets: targets});
      }
    });

    // Can always move (might be blocked by effects but in premise)
    actionList.push({action: Abilities.getAbility('Move'), targets: null});
    // Can only run away if in position 1 (and even then...)
    if (this.getCharacterLocation(char).arrayPosition === 0) {
      actionList.push({action: Abilities.getAbility('Flee'), targets: null});
    }
    // Can always pass
    actionList.push({action: Abilities.getAbility('Pass'), targets: null});
    return actionList;
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
              (battlefieldchar.owner && ability.targets.type !== 'ENEMY') ||
                (!battlefieldchar.owner && ability.targets.type !== 'ALLY')
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
    throw new Error('Character not found! Uh oh!');
  }

  removeFromBattle (char, reason) {
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

  async performFlee (char, fleeChance) {
    if (Math.random() <= fleeChance) {
      // Hooray!
      await this.send(Util.getDisplayName(char) + ' has fled the battle!');
      this.removeFromBattle(char, 'FLED');
    } else {
      // ;~;
      await this.send(Util.getDisplayName(char) + ' has failed their escape. Stand and deliver!');
    }
  }

  async performMove (char, directionIcon, moveChance) {
    let direction = (directionIcon === '⬅' ? 'left' : 'right');
    let successChance = moveChance[direction];
    if (Math.random() <= successChance) {
      // Hooray!
      let newPos = this.movePlayer(char, direction);
      await this.send('Successfully moved to position ' + newPos + '!');
    } else {
      // ;~;
      await this.send('Despite your best effort, your legs fail you.');
    }
  }

  movePlayer (char, direction) {
    let location = this.getCharacterLocation(char);
    let directionOffset = direction === 'left' ? -1 : 1;
    this.battlefield[location.arrayPosition].splice(location.arraySubposition, 1);
    this.battlefield[location.arrayPosition + directionOffset].push(char);
    return location.arrayPosition + directionOffset + 1;
  }

  async cancelAction (actionText) {
    // Bounce back to action select
    let questionToAsk = await this.send(`${actionText} has been cancelled. What would you like to do?`, true);
    Util.addReactions(questionToAsk, this.getIconsForActions(this.actionsForPlayer));
    this.state = 'SELECT_ABILITY';
    return 'BATTLING';
  }

  async cleanupEffects (caster, charactersToCleanup) {
    let characters = charactersToCleanup;
    if (!characters) {
      let effectiveChars = Util.getEffectiveCharacters(this.battlefield);
      characters = effectiveChars.players.concat(effectiveChars.enemies);
    }
    for (let i = 0; i < characters.length; i++) {
      await characters[i].cleanupEffect(caster, this);
    }
    for (let i = 0; i < this.battlefieldEffects.length; i++) {
      for (let j = this.battlefieldEffects[i].length - 1; j >= 0; j--) {
        // Hmm, this looks familiar ...
        let effect = this.battlefieldEffects[i][j];
        if (effect.whoApplied === caster) {
          if (effect.ticks === effect.currentTicks) {
            // Expire the effect
            if (effect.onRemoveBattlefield) {
              await effect.onRemoveBattlefield(this, caster);
            }
            this.battlefieldEffects[i].splice(j, 1);
          } else {
            if (effect.onTickBattlefield) {
              await effect.onTickBattlefield(this, caster);
            }
            effect.currentTicks++;
          }
        }
      }
    }
  }

  async useAbility (ability, caster, targets) {
    let effect = Util.clone(ability.effect); // Take copy
    effect.whoApplied = caster;
    if (ability.targets.number === 0) {
      // Battlefield effect, oBA handles the placement (battleManager still does cleanup ? )
      if (effect.onBattlefieldApply) {
        await effect.onBattlefieldApply(this, caster, targets);
      }
      targets.forEach(target => {
        this.battlefieldEffects[target].push(effect);
      });
    } else {
      // cast skill, use on each target
      for (let i = 0; i < targets.length; i++) {
        let target = targets[i];
        if (effect.onApply) {
          await effect.onApply(this, caster, target);
        }
        if (!target.alive) {
          await this.send(Util.getDisplayName(target) + ' has been slain!');
          this.removeFromBattle(target, 'DEAD');
        } else {
          target.effects.push(effect);
        }
      }
    }
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
    [dead, fled].forEach(arr => {
      text += (arr === dead ? '*Graveyard:* ' : '*Fled:* ');
      if (arr.length === 0) text += no;
      else {
        let people = arr.map(char => {
          return (char.owner ? Util.getMention(char.owner) : char.name);
        });
        text += Util.capitalise(Util.formattedList(Util.reduceList(people)));
      }
      text += '\n';
    });
    return text;
  }

  async send (string, saveId) {
    return this.gamemanager.send(string, saveId);
  }
};
