const Util = require('../util/util.js');
const Abilities = require('../mechanics/abilities.js');
const _ = require('underscore');

module.exports = class BattleManager {
  constructor (gamemanager, encounter) {
    this.gamemanager = gamemanager;
    this.encounter = encounter;
    this.playerInFocus = null;
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
    let turnResult = await this.performTurn();
    return turnResult;
  }

  async performTurn (reactionInfo) {
    if (!reactionInfo) {
      let effective = Util.getEffectiveCharacters(this.battlefield);
      // performTurn called not off an action, perform a game turn tick

      if (effective.players.length === 0) {
        // All players are dead! Oh no!
      } else if (effective.players.enemies === 0) {
        // All enemies are dead! Hooray!
      }

      if (this.queue.length === 0) {
        this.queue = this.prepareQueue(effective.players, effective.enemies);
        this.turn++;
      }

      // Now we have a queue with something in it, we can pop and evaluate

      let character = this.queue.shift();
      await this.send((character.owner ? Util.getMention(character.owner) : character.name) + ', you\'re up!');
      if (character.owner) {
        // Hand to the player to do an action, give them options.
        let validActions = this.getValidActions(character);
        console.log('Battlefield on your turn is...');
        console.log(this.battlefield);
        this.playerInFocus = character;
        this.actionsForPlayer = validActions;
        this.state = 'SELECT_ABILITY';

        let questionToAsk = await this.send('What would you like to do?', true);
        Util.addReactions(questionToAsk, this.getIconsForActions(validActions));
        return 'BATTLING';
      } else {
        // NPC, evaluate and tick (no interrupts).
        await character.logic.performTurn(this, character); // I don't know anyone I am
        // Let's go again!
        let result = await this.performTurn();
        return result;
      }
    } else {
      if (this.playerInFocus && reactionInfo.user.id === this.playerInFocus.owner) {
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
              let result = await this.performTurn();
              return result;
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
              // Bounce back to target select
              let questionToAsk = await this.send('Targeting cancelled. What would you like to do?', true);
              Util.addReactions(questionToAsk, this.getIconsForActions(this.actionsForPlayer));
              this.state = 'SELECT_ABILITY';
              return 'BATTLING';
            } else if (reactionInfo.react === '✅') {
              // Let's go get the targets...
              console.log(this.getTargetList(this.selectedAction.targets, true).icons);
              let targets = this.getSelectedOptions(reactions, this.getTargetList(this.selectedAction.targets, true).icons, reactionInfo.user.id);
              console.log(targets);
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

                await this.useAbility(this.selectedAction.action, this.playerInFocus, targetChars);

                // Turn over, move onto next person.
                let result = await this.performTurn();
                return result;
              }
              return 'BATTLING';
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
      targetString += numbers[i] + ' - ' + targetList[i].name + '\n';
    }
    let targetIcons = numbers.slice(0, targetList.length);
    if (!onlyIcons) {
      targetIcons.push('✅', '🚫');
    }
    return {msg: targetString, icons: targetIcons};
  }

  getMoveActions (char, onlyIcons) {
    let position = this.getCharacterLocation(char).arrayPosition;
    let msg = '';
    let icons = [];
    // Check if able to move
    let moveLeftDetails = char.iterateEffects('MOVE_BACKWARD', this, true);
    _.extend(moveLeftDetails, {
      text: 'left',
      position: 0,
      direction: 'back',
      icon: '⬅️'
    });
    let moveRightDetails = char.iterateEffects('MOVE_FORWARD', this, true);
    _.extend(moveRightDetails, {
      text: 'right',
      position: 5,
      direction: 'forward',
      icon: '➡️'
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

  async useAbility (ability, caster, targets) {
    let effect = Util.clone(ability.effect); // Take copy
    effect.whoApplied = caster;
    effect.turnApplied = this.turn;
    if (ability.targets.number === 0) {
      // Battlefield effect, oBA handles the placement (battleManager still does cleanup) ?
      await effect.onBattlefieldApply(this, caster, targets);
    } else {
      // cast skill, use on each target
      for (let i = 0; i < targets.length; i++) {
        let target = targets[i];
        await effect.onApply(this, caster, target);
        if (!target.alive) {
          await this.send(target.name + ' has been slain!');
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
    let text = '';
    let no = '-';
    for (let i = 0; i < battle.length; i++) {
      text += '*Position ' + (i + 1) + ':* ';
      if (battle[i].length === 0) text += no;
      for (let j = 0; j < battle[i].length; j++) {
        let char = battle[i][j];
        text += (j === 0 ? '' : ', ') + (char.owner ? Util.getMention(char.owner) : char.name) + ' @ ' + char.currenthp + '/' + char.hp + ' hp';
      }
      text += '\n';
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
