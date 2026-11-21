/**
 * Publishes the state of the active tool for the dynamic input box.
 *
 * Tools run in the script engine of their document, the dynamic input box in
 * the application's engine, so JS objects cannot be shared. The state is
 * passed as a JSON string property on the main window instead.
 */
var DynamicInputState = {
    property: "TataDynamicInputState"
};

DynamicInputState.isClass = function(action, className) {
    return !isNull(global[className]) && action instanceof global[className];
};

DynamicInputState.publish = function(action) {
    var appWin = RMainWindowQt.getMainWindow();
    if (isNull(appWin) || action.hasNoState()) {
        return;
    }

    var kind = "generic";
    if (DynamicInputState.isClass(action, "DrawBasedOnRectanglePP")) {
        kind = "rectangle";
    }
    else if (DynamicInputState.isClass(action, "CircleCP")) {
        kind = "circle";
    }
    else if (DynamicInputState.isClass(action, "ArcCPA")) {
        kind = "arc";
    }

    var info = {
        cls: action.getClassName(),
        state: isNumber(action.state) ? action.state : -1,
        kind: kind
    };
    if (isValidVector(action.center)) {
        info.cx = action.center.x;
        info.cy = action.center.y;
    }
    if (isNumber(action.radius)) {
        info.radius = action.radius;
    }
    appWin.setProperty(DynamicInputState.property, JSON.stringify(info));
};

DynamicInputState.clear = function(action) {
    var appWin = RMainWindowQt.getMainWindow();
    if (isNull(appWin) || action.hasNoState()) {
        return;
    }
    appWin.setProperty(DynamicInputState.property, "");
};

DynamicInputState.read = function() {
    var appWin = RMainWindowQt.getMainWindow();
    var json = isNull(appWin) ? undefined : appWin.property(DynamicInputState.property);
    if (isNull(json) || json === "") {
        return undefined;
    }
    try {
        return JSON.parse(json);
    }
    catch (e) {
        return undefined;
    }
};
