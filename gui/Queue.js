import Navigator from "./Navigator";
import { Button } from "./GuiBuilder";
import Settings from "../utils/config";

let queue = [];
let fails = [];
let timeWithoutOperation = 0;
let operationTimes = { started: 0, total: 0 };
let currentGuiContext = null;

register("tick", () => {
  if (queue.length > 0) timeWithoutOperation++;
  if (
    (timeWithoutOperation > Settings.guiTimeout) & (queue.length > 0) &&
    !Settings.useSafeMode && !Navigator.goto
  ) {
    fails.push(`&cOperation timed out. &f(too long without GUI click)`);
    doneLoading();
  }
  if (!Navigator.isReady) return;
  if (queue.length === 0) return;
  timeWithoutOperation = 0;
  if (Navigator.isReturning) return Navigator.returnToEditActions();
  if (Navigator.isSelecting) {
    const attemptResult = Navigator.selectOption(Navigator.optionBeingSelected);
    if (attemptResult === false)
      fails.push(
        `&cCouldn't find option &f${Navigator.optionBeingSelected} &cin &f${currentGuiContext}&c.`
      );
    return;
  }

  if (operationTimes.started === 0) operationTimes.started = Date.now();
  operationTimes.total++;
  if (Navigator.goto) operationTimes.started += 0.05;
  timeRemainingButton.setText(
    `Time Remaining: ${Math.round(
      (((Date.now() - operationTimes.started) / operationTimes.total) *
        queue.length) /
      1000
    )} seconds`
  );

  let [operationType, operationData] = queue.shift();
  if (operationType === "setGuiContext") {
    currentGuiContext = operationData.context; // for error messages
    if (queue.length === 0) return;
    [operationType, operationData] = queue.shift();
  }
  Navigator.goto = false;
  switch (operationType) {
    case "click":
      return Navigator.click(operationData.slot);
    case "anvil":
      return Navigator.inputAnvil(operationData.text);
    case "returnToEditActions":
      return Navigator.returnToEditActions();
    case "back":
      return Navigator.goBack();
    case "option":
      return Navigator.setSelecting(operationData.option);
    case "chat":
      return Navigator.inputChat(operationData.text, operationData.func, operationData.command);
    case "item":
      return Navigator.selectItem(operationData.item);
    case "closeGui":
      return Client.currentGui.close();
    case "goto":
      Navigator.goto = true;
      ChatLib.chat(`&3[HTSL] &fPlease open action container &e${operationData.name}`);
      Navigator.isReady = false;
      return;
    case "wait":
      Navigator.isReady = false;
      return setTimeout(() => {
        Navigator.isReady = true;
      }, operationData.time);
    case "done":
      return doneLoading();
  }
});

function doneLoading() {
  timeWithoutOperation = 0;
  Navigator.isWorking = false;
  queue = [];
  operationTimes = { started: 0, total: 0 };
  if (Settings.playSoundOnFinish) World.playSound("random.levelup", 2, 1);
  if (Settings.closeGUI) Client.currentGui.close();

  if (fails.length > 0) {
    ChatLib.chat(
      `&cFailed to load: &f(${fails.length} error${fails.length > 1 ? "s" : ""
      })`
    );
    fails.forEach((fail) => ChatLib.chat("   > " + fail));
    fails = [];
    ChatLib.chat(
      `&f${queue.length} &coperation${queue.length !== 1 ? "s" : ""
      } left in queue.`
    );
  } else {
    ChatLib.chat(`&3[HTSL] &fImported successfully!`);
  }
}

const timeRemainingButton = new Button(0, 0, 0, 20, "Time Remaining:");
const cancelButton = new Button(0, 100, 100, 20, "Cancel");

register("guiRender", (x, y) => {
  if (!Player.getContainer()) return;
  if (queue.length === 0) return;

  timeRemainingButton.setWidth(200);
  timeRemainingButton.setX(
    Renderer.screen.getWidth() / 2 - timeRemainingButton.getWidth() / 2
  );
  cancelButton.setX(
    Renderer.screen.getWidth() / 2 - (timeRemainingButton.getWidth() - 100) / 2
  );
  timeRemainingButton.setY(timeRemainingButton.getHeight() * 3);
  cancelButton.setY(timeRemainingButton.getHeight() * 3 + 20);
  timeRemainingButton.render(x, y);
  cancelButton.render(x, y);
});

register("guiMouseClick", (x, y) => {
  if (!Player.getContainer()) return;

  if (
    x > cancelButton.getX() &&
    x < cancelButton.getX() + cancelButton.getWidth() &&
    y > cancelButton.getY() &&
    y < cancelButton.getY() + cancelButton.getHeight()
  ) {
    fails.push(`&6Cancelled by user.`);
    queue.splice(0, queue.length - 1);
  }
});

export function addOperation(operation) {
  Navigator.isWorking = true;
  queue.push(operation);
}
