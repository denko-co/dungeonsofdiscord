const Interactable = require('../mechanics/interactable.js');
const Util = require('../util/util.js');

let interactables = {
  dungeonDoor: {
    name: 'Dungeon Door',
    description: 'Enterance to the dungeon. Who knows what\'s in store?',
    required: {direction: 'string'},
    logic: {
      state: {open: false},
      onInspect (gameManager) {
        if (this.logic.state.open) {
          gameManager.send('The door is ajar, enough for an adventurer to enter. Beyond it, faint lights, and boundless adventure.');
        } else {
          gameManager.send('The door is large and engraved with art of a forgotten time. It seems to be fused into the wall.');
        }
      }
    }
  },
  dungeonLever: {
    name: 'Dungeon Lever',
    description: 'An old lever.',
    required: {door: 'object'},
    logic: {
      state: {touched: false},
      interactionItems: ['Self'],
      onInteract (item, gameManager) {
        if (item === 'Self') {
          if (this.logic.state.touched) {
            gameManager.send('The lever shifts with tremendous ease. The door to your right shifts, as if by magic.');
            const referencedDoor = this.logic.state.door;
            referencedDoor.logic.state.open = true;
            gameManager.currentRoom.direction[referencedDoor.logic.state.direction] = true; // Jesus
          } else {
            gameManager.send('The lever appears to be jammed. It would take enormous strength to unbudge it.');
          }
        }
      },
      onInspect (gameManager) {
        gameManager.send('The lever is faded, eroded by time. Its handle is firm, maybe *too* firm.');
      }
    }
  }
};

exports.getInteractable = function (name, requiredParams, displayName) {
  let interactableDetails = interactables[Util.convertName(name)];
  if (!interactableDetails) {
    throw new Error(`Interactable with name ${name} not found!`);
  }
  let interactableToAdd = new Interactable(interactableDetails.name, displayName || interactableDetails.name, interactableDetails.description, interactableDetails.logic, interactableDetails.required);

  Util.verifyRequired(interactableToAdd.required, requiredParams, interactableToAdd.logic.state);

  return interactableToAdd;
};
