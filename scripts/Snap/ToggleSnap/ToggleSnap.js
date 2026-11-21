include("scripts/Snap/Snap.js");

function ToggleSnap(guiAction) {
    Snap.call(this, guiAction);
}

ToggleSnap.prototype = new Snap();

ToggleSnap.isOn = function(di) {
    if (isNull(di)) {
        return false;
    }
    return !isOfType(di.getSnap(), RSnapFree);
};

ToggleSnap.prototype.beginEvent = function() {
    EAction.prototype.beginEvent.call(this);

    var on = ToggleSnap.isOn(this.getDocumentInterface());
    // Going through the existing snap actions keeps the snap toolbar's
    // radio group in sync with the new state:
    var target = on ? "scripts/Snap/SnapFree/SnapFree.js"
                    : "scripts/Snap/SnapAuto/SnapAuto.js";
    var a = RGuiAction.getByScriptFile(target);
    if (!isNull(a)) {
        a.slotTrigger();
    }
    EAction.handleUserMessage(on ? qsTr("Snap off") : qsTr("Snap on (auto)"));
    this.terminate();
};

ToggleSnap.prototype.finishEvent = function() {
    EAction.prototype.finishEvent.call(this);
    var guiAction = this.getGuiAction();
    if (!isNull(guiAction)) {
        guiAction.setChecked(ToggleSnap.isOn(this.getDocumentInterface()));
    }
};

ToggleSnap.init = function(basePath) {
    var action = new RGuiAction(qsTr("Toggle &Snap"), RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/ToggleSnap.js");
    action.setDefaultShortcuts([new QKeySequence(new QKeyCombination(Qt.Key_F3))]);
    action.setDefaultCommands(["togglesnap", "osnap"]);
    action.setNoState(true);
    action.setOverride();
    action.setGroupSortOrder(15700);
    action.setSortOrder(200);
    action.setWidgetNames(["SnapMenu"]);
};

function ToggleSnapFocusListener(action) {
    RViewFocusListenerAdapter.call(this);
    this.action = action;
}

ToggleSnapFocusListener.prototype = new RViewFocusListenerAdapter();

ToggleSnapFocusListener.prototype.updateFocus = function(view) {
    var di = isNull(view) ? undefined : view.getDocumentInterface();
    this.action.checked = ToggleSnap.isOn(di);
};

ToggleSnap.postInit = function(basePath) {
    var action = RGuiAction.getByScriptFile("scripts/Snap/ToggleSnap/ToggleSnap.js");
    var free = RGuiAction.getByScriptFile("scripts/Snap/SnapFree/SnapFree.js");
    if (isNull(action) || isNull(free)) {
        return;
    }
    EAction.getMainWindow().addViewFocusListener(new ToggleSnapFocusListener(action));
    free.toggled.connect(function(checked) { action.setChecked(!checked); });
};
