const Util = require('../util/util.js');
const _ = require('underscore');

module.exports = class BattleManager {
  constructor (gamemanager, encounter) {
    this.gamemanager = gamemanager;
    this.encounter = encounter;
    this.playerInFocus = null;
    this.queue = [];
    this.battlefield = gamemanager.players.concat(encounter.positions.reverse());
    this.turn = 1;
  }

  async initialise () {
    await this.send(`*${Util.getBattleReadyText()}*`);
    await this.send(Util.getVsText(this.encounter.name));
    await this.send(`***${Util.getBattleStartText()}***`);
    await this.performTurn();
  }

  async performTurn (messageReaction) {
    if (!messageReaction) {
      let effective = Util.getEffectiveCharacters(this.battlefield);
      // performTurn called not off an action, perform a game turn tick

      if (effective.players.length === 0) {
        // All players are dead! Oh no!
      } else if (effective.players.enemies === 0) {
        // All enemies are dead! Hooray!
      }

      if (this.queue.length === 0) {
        this.queue = this.prepareQueue(effective.players, effective.enemies);
      }

      // Now we have a queue with something in it, we can pop and evaluate

      let character = this.queue.shift();
      if (character.owner) {
        // Hand to the player to do an action, give them options.
      } else {
        // NPC, evaluate and tick (no interrupts).
        await character.logic.performTurn(this, character); // I don't know anyone I am
      }
    } else {
      // Player has performed an action, check if it's good to go.
    }
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
    console.log(queue);
    return queue;
  }

  getValidActions (char) {
    let actionList = [];
    for (let item in char.items) {
      for (let itemabil in item.abilities) {
        // Check if the ability can target something. If it's not null, add it to the pool
        let targets = this.getValidTargets(char, itemabil);
        if (targets && targets.length !== 0) {
          actionList.push(itemabil, targets);
        }
      }
    }
    for (let charabil in char.abilities) {
      // As before
      let targets = this.getValidTargets(char, charabil);
      if (targets !== null) {
        actionList.push(charabil, targets);
      }
    }
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
      let position = this.getCharacterLocation(char)[0];
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
      return targets.length === 0 ? null : targets;
    }
  }

  getCharacterLocation (char) {
    for (let i = 0; i < this.battlefield.length; i++) {
      for (let j = 0; j < this.battlefield[i].length; j++) {
        // 'Member nested for loops? There's probably a more js way of doing this ...
        if (this.battlefield[i][j] === char) {
          return [i, j];
        }
      }
    }
    throw new Error('Character not found! Uh oh!');
  }

  async useAbility (ability, caster, targets) {
    let effect = _.clone(ability.effect); // Take  copy
    if (ability.targets.number === 0) {
      // Battlefield effect
      await effect.properties.onBattlefieldApply(this, caster, targets);
      console.log(this.battlefield);
    }
  }

  async send (string, saveId) {
    return this.gamemanager.send(string, saveId);
  }
};
