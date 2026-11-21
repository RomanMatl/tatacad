include("scripts/Snap/Snap.js");

function ToggleOrtho(guiAction) {
    Snap.call(this, guiAction);
}

ToggleOrtho.prototype = new Snap();

ToggleOrtho.isOn = function(di) {
    if (isNull(di)) {
        return false;
    }
    return isOfType(di.getSnapRestriction(), RRestrictOrthogonal);
};

ToggleOrtho.prototype.beginEvent = function() {
    EAction.prototype.beginEvent.call(this);

    var on = ToggleOrtho.isOn(this.getDocumentInterface());
    // Going through the existing restriction actions keeps the snap toolbar's
    // radio group in sync with the new state:
    var target = on ? "scripts/Snap/RestrictOff/RestrictOff.js"
                    : "scripts/Snap/RestrictOrthogonal/RestrictOrthogonal.js";
    var a = RGuiAction.getByScriptFile(target);
    if (!isNull(a)) {
        a.slotTrigger();
    }
    EAction.handleUserMessage(on ? qsTr("ORTHO off") : qsTr("ORTHO on"));
    this.terminate();
};

ToggleOrtho.prototype.finishEvent = function() {
    EAction.prototype.finishEvent.call(this);
    var guiAction = this.getGuiAction();
    if (!isNull(guiAction)) {
        guiAction.setChecked(ToggleOrtho.isOn(this.getDocumentInterface()));
    }
};

ToggleOrtho.init = function(basePath) {
    var action = new RGuiAction(qsTr("Toggle &Ortho Mode"), RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/ToggleOrtho.js");
    action.setDefaultShortcuts([new QKeySequence(new QKeyCombination(Qt.Key_F8))]);
    action.setDefaultCommands(["ortho", "toggleortho"]);
    action.setNoState(true);
    action.setOverride();
    action.setGroupSortOrder(15700);
    action.setSortOrder(100);
    action.setWidgetNames(["SnapMenu"]);
};

function ToggleOrthoFocusListener(action) {
    RViewFocusListenerAdapter.call(this);
    this.action = action;
}

ToggleOrthoFocusListener.prototype = new RViewFocusListenerAdapter();

ToggleOrthoFocusListener.prototype.updateFocus = function(view) {
    var di = isNull(view) ? undefined : view.getDocumentInterface();
    this.action.checked = ToggleOrtho.isOn(di);
};

ToggleOrtho.postInit = function(basePath) {
    var action = RGuiAction.getByScriptFile("scripts/Snap/ToggleOrtho/ToggleOrtho.js");
    var ortho = RGuiAction.getByScriptFile("scripts/Snap/RestrictOrthogonal/RestrictOrthogonal.js");
    if (isNull(action) || isNull(ortho)) {
        return;
    }
    EAction.getMainWindow().addViewFocusListener(new ToggleOrthoFocusListener(action));
    ortho.toggled.connect(function(checked) { action.setChecked(checked); });
};
