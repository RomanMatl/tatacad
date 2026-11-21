include("scripts/Widgets/Widgets.js");

/**
 * Floating calculator: evaluates expressions with RMath.eval (same engine as
 * all numeric input fields, e.g. "2*pi*15", "sqrt(2)", "sin(30)", "2,5+1"),
 * keeps a history and can pass the result to the command line.
 */
function Calculator(guiAction) {
    Widgets.call(this, guiAction);
}

Calculator.prototype = new Widgets();

Calculator.keys = [
    ["7", "8", "9", "/", "("],
    ["4", "5", "6", "*", ")"],
    ["1", "2", "3", "-", "sqrt("],
    ["0", ".", "pi", "+", "^"],
    ["sin(", "cos(", "tan(", "C", "="]
];

Calculator.evaluate = function(expression) {
    var expr = expression
        .replace(/\^/g, "**")
        .replace(/\b(pi|Pi)\b|π/g, "PI")
        .replace(/(\d),(\d)/g, "$1.$2");
    var value = RMath.eval(expr);
    if (RMath.hasError() || isNaN(value)) {
        return undefined;
    }
    return value;
};

Calculator.formatValue = function(value) {
    var s = numberToString(value, 10);
    if (s.indexOf(".") === -1) {
        return s;
    }
    return s.replace(/0+$/, "").replace(/\.$/, "");
};

Calculator.prototype.beginEvent = function() {
    Widgets.prototype.beginEvent.call(this);

    var dock = RMainWindowQt.getMainWindow().findChild("CalculatorDock");
    if (!isNull(dock)) {
        if (!dock.visible) {
            dock.visible = true;
            dock.raise();
            var input = dock.findChild("CalculatorInput");
            if (!isNull(input)) {
                input.setFocus(Qt.OtherFocusReason);
            }
        }
        else {
            dock.visible = false;
        }
    }
    this.terminate();
};

Calculator.prototype.finishEvent = function() {
    Widgets.prototype.finishEvent.call(this);
    var dock = RMainWindowQt.getMainWindow().findChild("CalculatorDock");
    if (!isNull(dock)) {
        this.getGuiAction().setChecked(dock.visible);
    }
};

Calculator.init = function(basePath) {
    var appWin = RMainWindowQt.getMainWindow();

    var action = new RGuiAction(qsTr("&Calculator"), appWin);
    action.setRequiresDocument(false);
    action.setScriptFile(basePath + "/Calculator.js");
    action.setDefaultShortcut(new QKeySequence("k,a"));
    action.setDefaultCommands(["calculator", "cal", "ka"]);
    action.setGroupSortOrder(3600);
    action.setSortOrder(60);
    action.setWidgetNames(["ViewMenu", "WidgetsToolBar", "ViewToolsPanel", "WidgetMatrixPanel"]);

    var dock = new RDockWidget(qsTr("Calculator"), appWin);
    dock.objectName = "CalculatorDock";
    var w = WidgetFactory.createWidget(basePath, "Calculator.ui", dock);
    var history = w.findChild("CalculatorHistory");
    var input = w.findChild("CalculatorInput");
    var result = w.findChild("CalculatorResult");

    var compute = function() {
        var expr = input.text.trim();
        if (expr.length === 0) {
            return;
        }
        var value = Calculator.evaluate(expr);
        if (isNull(value)) {
            result.text = "<font color='red'>" + qsTr("Invalid expression") + "</font>";
            return;
        }
        var text = Calculator.formatValue(value);
        result.text = "<b>= " + text + "</b>";
        history.insertItem(0, new QListWidgetItem(expr + " = " + text));
        input.text = text;
        input.selectAll();
    };
    input.returnPressed.connect(compute);

    history.itemDoubleClicked.connect(function(item) {
        var t = item.text();
        input.text = t.substring(t.lastIndexOf("= ") + 2);
        input.setFocus(Qt.OtherFocusReason);
    });

    var grid = w.findChild("KeysLayout");
    for (var r = 0; r < Calculator.keys.length; r++) {
        for (var c = 0; c < Calculator.keys[r].length; c++) {
            (function(key) {
                var b = new QToolButton(w);
                b.text = key === "sqrt(" ? "√" : (key === "pi" ? "π" : key);
                b.sizePolicy = new QSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed);
                b.clicked.connect(function() {
                    if (key === "=") {
                        compute();
                    }
                    else if (key === "C") {
                        input.text = "";
                        result.text = "";
                    }
                    else {
                        input.insert(key);
                    }
                    input.setFocus(Qt.OtherFocusReason);
                });
                grid.addWidget(b, r, c);
            })(Calculator.keys[r][c]);
        }
    }
    var toCommandLine = w.findChild("CalculatorToCommandLine");
    toCommandLine.clicked.connect(function() {
        var commandEdit = appWin.findChild("CommandEdit");
        if (isNull(commandEdit)) {
            return;
        }
        commandEdit.setText(input.text);
        commandEdit.setFocus(Qt.OtherFocusReason);
    });

    dock.setWidget(w);
    appWin.addDockWidget(Qt.RightDockWidgetArea, dock);
    dock.visible = false;

    dock.shown.connect(function() { action.setChecked(true); });
    dock.hidden.connect(function() { action.setChecked(false); });
};

Calculator.uninit = function() {
    var dock = RMainWindowQt.getMainWindow().findChild("CalculatorDock");
    if (!isNull(dock)) {
        destr(dock);
    }
};
