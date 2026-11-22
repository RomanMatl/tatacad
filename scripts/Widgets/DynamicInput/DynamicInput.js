include("scripts/Widgets/Widgets.js");
include("DynamicInputState.js");

/**
 * AutoCAD-style dynamic input (F12): input fields that depend on the active
 * tool and its state, shown in the command line row (a box that follows the
 * cursor cannot be clicked) and mirrored in a read-only box next to the cursor:
 * - first point: X, Y
 * - next point (lines, polylines, move, ...): length, angle from the last point
 * - rectangle second corner: width, height
 * - circle (center, point): radius or diameter
 * - arc (center, radius, angles): radius, then angle
 * plus the numeric options of the tool (e.g. polygon corners, offset distance).
 *
 * Typing a number while drawing goes to the first field; Tab moves to the next
 * field, "," and "<" jump to the next field like in AutoCAD, Enter places the
 * point. Fields left empty follow the cursor.
 */
function DynamicInput(guiAction) {
    Widgets.call(this, guiAction);
}

DynamicInput.prototype = new Widgets();

DynamicInput.settingsKey = "DynamicInput/Enabled";
DynamicInput.lastDi = undefined;
DynamicInput.signature = undefined;
DynamicInput.fields = [];
DynamicInput.box = undefined;
DynamicInput.bar = undefined;
DynamicInput.redirecting = false;

DynamicInput.isEnabled = function() {
    return RSettings.getBoolValue(DynamicInput.settingsKey, true);
};

DynamicInput.prototype.beginEvent = function() {
    Widgets.prototype.beginEvent.call(this);
    var on = !DynamicInput.isEnabled();
    RSettings.setValue(DynamicInput.settingsKey, on);
    this.getGuiAction().setChecked(on);
    if (!on) {
        DynamicInput.hideBox();
    }
    EAction.handleUserMessage(on ? qsTr("Dynamic input on") : qsTr("Dynamic input off"));
    this.terminate();
};

/**
 * \return Geometry input mode for the published tool state (see
 * DynamicInputState) and the current click mode.
 */
DynamicInput.getMode = function(info, di) {
    if (isNull(info) || isNull(di)) {
        return "none";
    }
    // The published state can be stale (e.g. after killing all tools):
    var current = di.getCurrentAction();
    var guiAction = isNull(current) ? undefined : current.getGuiAction();
    if (isNull(guiAction) || guiAction.getScriptClass() !== info.cls) {
        return "none";
    }
    if (di.getClickMode() !== RAction.PickCoordinate) {
        return "options";
    }
    if (info.kind === "rectangle" && info.state === 1) {
        return "rectangle";
    }
    if (info.kind === "circle" && info.state === 1) {
        return "circle";
    }
    if (info.kind === "arc") {
        if (info.state === 1) {
            return "radius";
        }
        if (info.state === 2 || info.state === 3) {
            return "arcangle";
        }
    }
    if (info.state <= 0) {
        return "point";
    }
    return "polar";
};

DynamicInput.modeFields = {
    "point": [["x", "X"], ["y", "Y"]],
    "polar": [["length", "Délka"], ["angle", "Úhel °"]],
    "rectangle": [["width", "Šířka"], ["height", "Výška"]],
    "circle": [["radius", "Poloměr"], ["diameter", "Průměr"]],
    "radius": [["radius", "Poloměr"]],
    "arcangle": [["angle", "Úhel °"]],
    "options": [],
    "none": []
};

// Labels for option widgets that have no buddy label in their toolbar:
DynamicInput.optionLabels = {
    "Radius": "Poloměr", "Distance": "Vzdálenost", "Number": "Počet", "Corners": "Vrcholy",
    "Length": "Délka", "Angle": "Úhel", "Width": "Šířka", "Height": "Výška",
    "Length1": "Délka 1", "Length2": "Délka 2", "Factor": "Faktor", "Gap": "Mezera"
};

// Options already covered by the length / angle fields:
DynamicInput.skippedOptions = ["Length", "Angle"];

/**
 * \return [{name, label, widget}] of the numeric option widgets of the
 * current tool's options toolbar.
 */
DynamicInput.getOptionWidgets = function(mode) {
    var ret = [];
    var tb = EAction.getOptionsToolBar();
    if (isNull(tb)) {
        return ret;
    }
    var widgets = getWidgets(tb);
    var labels = {};
    var name;
    for (name in widgets) {
        var l = widgets[name];
        if (isFunction(l.buddy) && !isNull(l.buddy())) {
            labels[l.buddy().objectName] = l.text.replace(/&/g, "").replace(/:\s*$/, "");
        }
    }
    for (name in widgets) {
        var w = widgets[name];
        var isLineEdit = isFunction(w.getValue) && isFunction(w.setText);
        var isSpinBox = !isLineEdit && isFunction(w.setValue) && isFunction(w.stepUp);
        if (!isLineEdit && !isSpinBox) {
            continue;
        }
        // Toolbar widgets are wrapped in widget actions; the widget itself
        // reports invisible, its action tells whether it is shown:
        var wa = widgets[name + "Action"];
        if (!w.enabled || (!isNull(wa) && !wa.visible)) {
            continue;
        }
        if ((mode === "polar" || mode === "point") && DynamicInput.skippedOptions.indexOf(name) !== -1) {
            continue;
        }
        var label = labels[name];
        if (isNull(label)) {
            label = isNull(DynamicInput.optionLabels[name]) ? name : DynamicInput.optionLabels[name];
        }
        ret.push({ name: name, label: label, widget: w, spin: isSpinBox });
    }
    return ret;
};

DynamicInput.getView = function() {
    var di = DynamicInput.lastDi;
    return isNull(di) ? undefined : di.getLastKnownViewWithFocus();
};

DynamicInput.hideBox = function() {
    if (!isNull(DynamicInput.box) && !isDeleted(DynamicInput.box)) {
        DynamicInput.box.visible = false;
    }
    if (!isNull(DynamicInput.bar) && !isDeleted(DynamicInput.bar)) {
        DynamicInput.bar.visible = false;
    }
};

DynamicInput.getBox = function(viewWidget) {
    var box = viewWidget.findChild("DynamicInputBox");
    if (isNull(box)) {
        box = new QWidget(viewWidget);
        box.objectName = "DynamicInputBox";
        box.setAttribute(Qt.WA_TransparentForMouseEvents, true);
        box.styleSheet =
            "QWidget#DynamicInputBox { background-color: rgba(255,255,225,235);"
            + " border: 1px solid #888; border-radius: 3px; }"
            + " QLabel { color: black; background: transparent; }"
            + " QLabel#DynamicInputValues { color: #1565c0; }";
        var vbox = new QVBoxLayout(box);
        vbox.setContentsMargins(5, 3, 5, 3);
        vbox.setSpacing(2);
        var info = new QLabel(box);
        info.objectName = "DynamicInputInfo";
        vbox.addWidget(info);
        var values = new QLabel(box);
        values.objectName = "DynamicInputValues";
        vbox.addWidget(values);
        values.visible = false;
    }
    DynamicInput.box = box;
    return box;
};

/**
 * \return Row of input fields placed between the command line prompt
 * ("Next point:") and the command line edit.
 */
DynamicInput.getBar = function() {
    if (!isNull(DynamicInput.bar) && !isDeleted(DynamicInput.bar)) {
        return DynamicInput.bar;
    }
    var commandEdit = EAction.getMainWindow().findChild("CommandEdit");
    if (isNull(commandEdit)) {
        return undefined;
    }
    var parent = commandEdit.parentWidget();
    var bar = new QWidget(parent);
    bar.objectName = "DynamicInputBar";
    bar.styleSheet = "QLineEdit { min-width: 70px; max-width: 100px; }"
        + " QLineEdit:focus { border: 1px solid #1565c0; }";
    var layout = new QHBoxLayout(bar);
    layout.setContentsMargins(0, 0, 4, 0);
    layout.setSpacing(4);
    var row = parent.findChild("horizontalLayout");
    if (!isNull(row) && isFunction(row.insertWidget)) {
        row.insertWidget(1, bar);
    }
    else {
        parent.layout().addWidget(bar);
    }
    bar.visible = false;
    DynamicInput.bar = bar;
    DynamicInput.signature = undefined;
    return bar;
};

/**
 * Shows the typed values next to the cursor.
 */
DynamicInput.updateValues = function() {
    if (isNull(DynamicInput.box) || isDeleted(DynamicInput.box)) {
        return;
    }
    var parts = [];
    for (var i = 0; i < DynamicInput.fields.length; i++) {
        var f = DynamicInput.fields[i];
        if (f.geometry && f.edit.text.trim().length > 0) {
            parts.push(f.label.text + ": " + f.edit.text.trim());
        }
    }
    var values = DynamicInput.box.findChild("DynamicInputValues");
    values.text = parts.join("   ");
    values.visible = parts.length > 0;
};

DynamicInput.clearFields = function() {
    for (var i = 0; i < DynamicInput.fields.length; i++) {
        destr(DynamicInput.fields[i].label);
        destr(DynamicInput.fields[i].edit);
    }
    DynamicInput.fields = [];
};

DynamicInput.buildFields = function(bar, mode) {
    DynamicInput.clearFields();
    var layout = bar.layout();
    var specs = [];
    var geo = DynamicInput.modeFields[mode] || [];
    for (var i = 0; i < geo.length; i++) {
        specs.push({ key: geo[i][0], label: geo[i][1], geometry: true });
    }
    var opts = DynamicInput.getOptionWidgets(mode);
    for (var k = 0; k < opts.length; k++) {
        specs.push({ key: "opt:" + opts[k].name, label: opts[k].label, geometry: false, target: opts[k].widget, spin: opts[k].spin });
    }

    for (var r = 0; r < specs.length; r++) {
        (function(spec, row) {
            var label = new QLabel(spec.label, bar);
            var edit = new QLineEdit(bar);
            edit.objectName = "DynamicInput_" + spec.key;
            if (!spec.geometry) {
                edit.text = spec.spin ? String(spec.target.value) : spec.target.text;
            }
            layout.addWidget(label, 0, 0);
            layout.addWidget(edit, 0, 0);
            // children added to an already visible widget are not shown by Qt:
            label.visible = true;
            edit.visible = true;
            var field = { key: spec.key, label: label, edit: edit, geometry: spec.geometry, target: spec.target, spin: spec.spin };
            DynamicInput.fields.push(field);

            edit.textEdited.connect(function(text) { DynamicInput.onTextEdited(field, text); });
            edit.returnPressed.connect(function() { DynamicInput.onReturn(field); });
        })(specs[r], r);
    }
    bar.visible = specs.length > 0;
};

DynamicInput.getField = function(key) {
    for (var i = 0; i < DynamicInput.fields.length; i++) {
        if (DynamicInput.fields[i].key === key) {
            return DynamicInput.fields[i];
        }
    }
    return undefined;
};

DynamicInput.focusNext = function(field, text) {
    var i = DynamicInput.fields.indexOf(field);
    var next = DynamicInput.fields[i + 1];
    if (isNull(next)) {
        return;
    }
    if (!isNull(text)) {
        next.edit.text = text;
    }
    next.edit.setFocus(Qt.TabFocusReason);
};

/**
 * AutoCAD habit: "," after X jumps to Y, "<" after a length jumps to the angle.
 */
DynamicInput.onTextEdited = function(field, text) {
    DynamicInput.updateValues();
    var sep = undefined;
    if (field.key === "x" && /^[-+]?[\d.]+,/.test(text)) {
        sep = ",";
    }
    if (field.key === "length" && text.indexOf("<") !== -1) {
        sep = "<";
    }
    if (isNull(sep)) {
        return;
    }
    var idx = text.indexOf(sep);
    field.edit.text = text.substring(0, idx);
    DynamicInput.focusNext(field, text.substring(idx + 1));
};

DynamicInput.evalField = function(key) {
    var f = DynamicInput.getField(key);
    if (isNull(f)) {
        return undefined;
    }
    var t = f.edit.text.trim();
    if (t.length === 0) {
        return undefined;
    }
    var v = RMath.eval(t.replace(/(\d),(\d)/g, "$1.$2"));
    return (RMath.hasError() || isNaN(v)) ? undefined : v;
};

/**
 * \return Model position from the typed values, empty fields follow the cursor.
 */
DynamicInput.computePosition = function(mode, di, info) {
    var rz = di.getRelativeZero();
    var cursor = di.getCursorPosition();
    var v;
    switch (mode) {
    case "point":
        v = [DynamicInput.evalField("x"), DynamicInput.evalField("y")];
        return new RVector(isNull(v[0]) ? cursor.x : v[0], isNull(v[1]) ? cursor.y : v[1]);
    case "polar":
        var len = DynamicInput.evalField("length");
        var ang = DynamicInput.evalField("angle");
        if (isNull(len)) {
            len = rz.getDistanceTo(cursor);
        }
        var a = isNull(ang) ? rz.getAngleTo(cursor) : RMath.deg2rad(ang);
        return rz.operator_add(RVector.createPolar(len, a));
    case "rectangle":
        var w = DynamicInput.evalField("width");
        var h = DynamicInput.evalField("height");
        var sx = cursor.x >= rz.x ? 1 : -1;
        var sy = cursor.y >= rz.y ? 1 : -1;
        return rz.operator_add(new RVector(
            sx * (isNull(w) ? Math.abs(cursor.x - rz.x) : w),
            sy * (isNull(h) ? Math.abs(cursor.y - rz.y) : h)));
    case "circle":
    case "radius":
        var r = DynamicInput.evalField("radius");
        var d = DynamicInput.evalField("diameter");
        if (isNull(r) && !isNull(d)) {
            r = d / 2;
        }
        if (isNull(r)) {
            r = rz.getDistanceTo(cursor);
        }
        return rz.operator_add(RVector.createPolar(r, rz.getAngleTo(cursor)));
    case "arcangle":
        var aa = DynamicInput.evalField("angle");
        var center = isNumber(info.cx) ? new RVector(info.cx, info.cy) : rz;
        var radius = isNumber(info.radius) ? info.radius : center.getDistanceTo(cursor);
        var angle = isNull(aa) ? center.getAngleTo(cursor) : RMath.deg2rad(aa);
        return center.operator_add(RVector.createPolar(radius, angle));
    }
    return undefined;
};

DynamicInput.onReturn = function(field) {
    if (!field.geometry) {
        if (field.spin) {
            var n = parseInt(field.edit.text, 10);
            if (!isNaN(n)) {
                field.target.setValue(n);
            }
            field.edit.text = String(field.target.value);
        }
        else {
            field.target.setText(field.edit.text.replace(/(\d),(\d)/g, "$1.$2"));
        }
        return;
    }

    var info = DynamicInputState.read();
    var di = DynamicInput.lastDi;
    var view = DynamicInput.getView();
    if (isNull(info) || isNull(di) || isNull(view)) {
        return;
    }
    var pos = DynamicInput.computePosition(DynamicInput.getMode(info, di), di, info);
    if (!isValidVector(pos)) {
        return;
    }
    for (var i = 0; i < DynamicInput.fields.length; i++) {
        if (DynamicInput.fields[i].geometry) {
            DynamicInput.fields[i].edit.text = "";
        }
    }
    DynamicInput.updateValues();
    view.getWidget().setFocus(Qt.OtherFocusReason);
    di.coordinateEvent(new RCoordinateEvent(pos, view.getScene(), getRGraphicsView(view)));
};

/**
 * First digit typed into the command line while a tool expects input goes
 * to the first dynamic input field instead.
 */
DynamicInput.onCommandTextChanged = function(commandEdit, text) {
    if (DynamicInput.redirecting || !DynamicInput.isEnabled() || DynamicInput.fields.length === 0) {
        return;
    }
    if (!/^[-+]?[\d.]/.test(text)) {
        return;
    }
    var first = DynamicInput.fields[0];
    if (!first.edit.visible) {
        return;
    }
    DynamicInput.redirecting = true;
    commandEdit.setText("");
    DynamicInput.redirecting = false;
    first.edit.text = text;
    first.edit.setFocus(Qt.OtherFocusReason);
    DynamicInput.onTextEdited(first, text);
};

DynamicInput.update = function(di) {
    if (!isNull(di)) {
        DynamicInput.lastDi = di;
    }
    di = DynamicInput.lastDi;
    if (!DynamicInput.isEnabled() || isNull(di)) {
        DynamicInput.hideBox();
        return;
    }
    var view = di.getLastKnownViewWithFocus();
    if (isNull(view)) {
        return;
    }
    var box = DynamicInput.getBox(view.getWidget());
    var bar = DynamicInput.getBar();

    var info = DynamicInputState.read();
    var mode = DynamicInput.getMode(info, di);
    var sig = mode + "|" + (isNull(info) ? "" : info.cls + ":" + info.state);
    if (sig !== DynamicInput.signature && !isNull(bar)) {
        DynamicInput.signature = sig;
        DynamicInput.buildFields(bar, mode);
        DynamicInput.updateValues();
    }

    var cursor = di.getCursorPosition();
    var rz = di.getRelativeZero();
    var info = box.findChild("DynamicInputInfo");
    if (isValidVector(cursor) && isValidVector(rz) && mode !== "point" && mode !== "none" && mode !== "options") {
        info.text = "%1 < %2°".arg(numberToString(rz.getDistanceTo(cursor), 3))
                              .arg(numberToString(RMath.rad2deg(rz.getAngleTo(cursor)), 2));
        info.visible = true;
    }
    else if (isValidVector(cursor) && mode === "point") {
        info.text = "%1, %2".arg(numberToString(cursor.x, 3)).arg(numberToString(cursor.y, 3));
        info.visible = true;
    }
    else {
        info.visible = false;
    }

    if (!info.visible && !box.findChild("DynamicInputValues").visible) {
        box.visible = false;
        return;
    }
    box.adjustSize();
    if (isValidVector(cursor)) {
        var p = view.mapToView(cursor);
        box.move(Math.round(p.x) + 18, Math.round(p.y) + 18);
    }
    box.visible = true;
    box.raise();
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
        commandEdit.textChanged.connect(function(text) {
            DynamicInput.onCommandTextChanged(commandEdit, text);
        });
    }
};
