include("scripts/Widgets/Widgets.js");

/**
 * AutoCAD-style dynamic input (F12): a small box next to the cursor showing
 * the distance and angle from the last point and the text being typed into
 * the command line. Typed values (e.g. "@50<30", "100", "10,20") are entered
 * through the command line as usual.
 */
function DynamicInput(guiAction) {
    Widgets.call(this, guiAction);
}

DynamicInput.prototype = new Widgets();

DynamicInput.settingsKey = "DynamicInput/Enabled";
DynamicInput.lastDi = undefined;

DynamicInput.isEnabled = function() {
    return RSettings.getBoolValue(DynamicInput.settingsKey, true);
};

DynamicInput.prototype.beginEvent = function() {
    Widgets.prototype.beginEvent.call(this);
    var on = !DynamicInput.isEnabled();
    RSettings.setValue(DynamicInput.settingsKey, on);
    this.getGuiAction().setChecked(on);
    if (!on) {
        DynamicInput.hideLabel();
    }
    EAction.handleUserMessage(on ? qsTr("Dynamic input on") : qsTr("Dynamic input off"));
    this.terminate();
};

DynamicInput.getLabel = function(viewWidget, create) {
    var label = viewWidget.findChild("DynamicInputLabel");
    if (isNull(label) && create) {
        label = new QLabel(viewWidget);
        label.objectName = "DynamicInputLabel";
        label.setAttribute(Qt.WA_TransparentForMouseEvents, true);
        label.styleSheet = "QLabel { background-color: rgba(255,255,225,230); color: black;"
            + " border: 1px solid #888; border-radius: 3px; padding: 2px 5px; }";
    }
    return label;
};

DynamicInput.hideLabel = function() {
    var di = DynamicInput.lastDi;
    if (isNull(di)) {
        return;
    }
    var view = di.getLastKnownViewWithFocus();
    if (isNull(view)) {
        return;
    }
    var label = DynamicInput.getLabel(view.getWidget(), false);
    if (!isNull(label)) {
        label.visible = false;
    }
};

DynamicInput.getText = function(di, typed) {
    var cursor = di.getCursorPosition();
    var zero = di.getRelativeZero();
    var lines = [];
    if (isValidVector(cursor) && isValidVector(zero)) {
        var dist = zero.getDistanceTo(cursor);
        var angle = RMath.rad2deg(zero.getAngleTo(cursor));
        lines.push("%1 < %2°".arg(numberToString(dist, 3)).arg(numberToString(angle, 2)));
    }
    if (!isNull(typed) && typed.length > 0) {
        lines.push("» " + typed);
    }
    return lines.join("\n");
};

DynamicInput.update = function(di) {
    if (!isNull(di)) {
        DynamicInput.lastDi = di;
    }
    di = DynamicInput.lastDi;
    if (!DynamicInput.isEnabled() || isNull(di)) {
        return;
    }
    var view = di.getLastKnownViewWithFocus();
    if (isNull(view)) {
        return;
    }
    var label = DynamicInput.getLabel(view.getWidget(), true);
    var commandEdit = RMainWindowQt.getMainWindow().findChild("CommandEdit");
    var text = DynamicInput.getText(di, isNull(commandEdit) ? "" : commandEdit.text);
    if (text.length === 0) {
        label.visible = false;
        return;
    }
    label.text = text;
    label.adjustSize();
    var p = view.mapToView(di.getCursorPosition());
    label.move(Math.round(p.x) + 18, Math.round(p.y) + 18);
    label.visible = true;
    label.raise();
};

DynamicInput.init = function(basePath) {
    var action = new RGuiAction(qsTr("&Dynamic Input"), RMainWindowQt.getMainWindow());
    action.setRequiresDocument(false);
    action.setScriptFile(basePath + "/DynamicInput.js");
    action.setDefaultShortcuts([new QKeySequence(new QKeyCombination(Qt.Key_F12))]);
    action.setDefaultCommands(["dynmode", "dynamicinput"]);
    action.setNoState(true);
    action.setOverride();
    action.setGroupSortOrder(3800);
    action.setSortOrder(300);
    action.setWidgetNames(["ViewMenu"]);
    action.setChecked(DynamicInput.isEnabled());
};

DynamicInput.postInit = function(basePath) {
    var appWin = RMainWindowQt.getMainWindow();
    var adapter = new RCoordinateListenerAdapter();
    appWin.addCoordinateListener(adapter);
    adapter.coordinateUpdated.connect(DynamicInput.update);

    var commandEdit = appWin.findChild("CommandEdit");
    if (!isNull(commandEdit)) {
        commandEdit.textChanged.connect(function() { DynamicInput.update(); });
    }
};
