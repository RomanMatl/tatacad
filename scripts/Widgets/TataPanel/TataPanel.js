include("scripts/Widgets/Widgets.js");

// status: "ok" = QCAD action exists, "partial" = exists with limitations (note),
// "missing" = no backend yet (button is red). Flip a row's status once its backend lands.
TataPanel.sections = [
    { title: "Kreslení", items: [
        { label: "Úsečka", script: "Draw/Line/Line2P/Line2P.js", status: "ok" },
        { label: "Přímka", script: "Draw/Line/XLine2P/XLine2P.js", status: "ok" },
        { label: "Křivka", script: "Draw/Polyline/DrawPolyline/DrawPolyline.js", status: "ok" },
        { label: "Mnohoúhelník", script: "Draw/Shape/ShapePolygonCP/ShapePolygonCP.js", status: "ok" },
        { label: "Obdélník", script: "Draw/Shape/ShapeRectanglePP/ShapeRectanglePP.js", status: "ok" },
        { label: "Tři body", script: "Draw/Arc/Arc3P/Arc3P.js", status: "ok" },
        { label: "Kružnice", script: "Draw/Circle/CircleCR/CircleCR.js", status: "ok" },
        { label: "Spline", script: "Draw/Spline/SplineControlPoints/SplineControlPoints.js", status: "ok" },
        { label: "Elipsa", script: "Draw/Ellipse/EllipseCPP/EllipseCPP.js", status: "ok" },
        { label: "Eliptický oblouk", script: "Draw/Ellipse/EllipseArcCPPA/EllipseArcCPPA.js", status: "ok" },
        { label: "Vložit blok", script: "Block/InsertBlock/InsertBlock.js", status: "ok" },
        { label: "Vytvořit blok", script: "Block/CreateBlock/CreateBlock.js", status: "ok" },
        { label: "Šrafování", script: "Draw/Hatch/HatchPick/HatchPick.js", status: "partial",
          note: "Klikni dovnitř uzavřené oblasti. Ostrovy (otvory uvnitř oblasti) zatím nejsou podporovány; pro ně použij Hatch from Selection." },
        { label: "Tabulka", script: "Draw/Table/Table.js", status: "partial",
          note: "Tabulka se vytvoří z čar a textů (po vložení je vybraná, dá se posunout). Editace jako tabulky (slučování buněk, úprava obsahu) zatím není." },
        { label: "Odstavcový text", script: "Draw/Text/Text.js", status: "ok" }
    ]},
    { title: "Modifikace", items: [
        { label: "Posun", script: "Modify/Translate/Translate.js", status: "ok" },
        { label: "Rotace", script: "Modify/Rotate/Rotate.js", status: "ok" },
        { label: "Zrcadlení", script: "Modify/Mirror/Mirror.js", status: "ok" },
        { label: "Odsazení", script: "Modify/Offset/Offset.js", status: "ok" },
        { label: "Pole", script: "Modify/ArrayTool/ArrayTool.js", status: "ok" },
        { label: "Protáhnout", script: "Modify/Stretch/Stretch.js", status: "ok" },
        { label: "Oříznout", script: "Modify/Trim/Trim.js", status: "ok" },
        { label: "Prodloužit", script: "Modify/Lengthen/Lengthen.js", status: "ok" },
        { label: "Přerušit", script: "Modify/BreakOut/BreakOut.js", status: "ok" },
        { label: "Zkosit", script: "Modify/Bevel/Bevel.js", status: "ok" },
        { label: "Zaoblit", script: "Modify/Round/Round.js", status: "ok" },
        { label: "Rozložit", script: "Modify/Explode/Explode.js", status: "ok" }
    ]},
    { title: "Kóty", items: [
        { label: "Přímá kóta", script: "Draw/Dimension/DimRotated/DimRotated.js", status: "ok" },
        { label: "Šikmá kóta", script: "Draw/Dimension/DimAligned/DimAligned.js", status: "ok" },
        { label: "Délka oblouku", script: "Draw/Dimension/DimArcLength/DimArcLength.js", status: "ok" },
        { label: "Poloměr", script: "Draw/Dimension/DimRadial/DimRadial.js", status: "ok" },
        { label: "Průměr", script: "Draw/Dimension/DimDiametric/DimDiametric.js", status: "ok" },
        { label: "Úhel", script: "Draw/Dimension/DimAngular/DimAngular.js", status: "ok" },
        { label: "Středová značka", script: "Draw/Dimension/CenterMark/CenterMark.js", status: "ok" },
        { label: "Multiodkaz", script: "Draw/Dimension/MultiLeader/MultiLeader.js", status: "ok" },
        { label: "Kótovací styl", script: "Draw/Dimension/DimStyles/DimStyles.js", status: "ok" }
    ]},
    { title: "Režimy a nástroje", items: [
        { label: "ORTHO (F8)", script: "Snap/ToggleOrtho/ToggleOrtho.js", status: "ok", toggle: true },
        { label: "Přichytávání (F3)", script: "Snap/ToggleSnap/ToggleSnap.js", status: "ok", toggle: true },
        { label: "Dynamické zadávání (F12)", script: "Widgets/DynamicInput/DynamicInput.js", status: "ok", toggle: true },
        { label: "Kalkulačka", script: "Widgets/Calculator/Calculator.js", status: "ok" },
        { label: "Posun pohledu", script: "View/Zoom/PanZoom/PanZoom.js", status: "ok" }
    ]},
    { title: "Hladiny", items: [
        { label: "Seznam hladin", script: "Widgets/LayerList/LayerList.js", status: "ok" },
        { label: "Přidat hladinu", script: "Layer/AddLayer/AddLayer.js", status: "ok" },
        { label: "Přidat N hladin", script: "Layer/AddLayers/AddLayers.js", status: "ok" },
        { label: "Upravit hladinu", script: "Layer/EditLayer/EditLayer.js", status: "ok" },
        { label: "Viditelnost", script: "Layer/ToggleLayerVisibility/ToggleLayerVisibility.js", status: "ok" },
        { label: "Zamknout", script: "Layer/ToggleLayerLock/ToggleLayerLock.js", status: "ok" },
        { label: "Zmrazit", script: "Layer/ToggleLayerFreeze/ToggleLayerFreeze.js", status: "ok" }
    ]}
];

TataPanel.styleMissing = "QToolButton { background-color: #c62828; color: white; border-radius: 3px; padding: 3px; }";
TataPanel.stylePartial = "QToolButton { border: 2px solid #ef6c00; border-radius: 3px; padding: 1px; }";

function TataPanel(guiAction) {
    Widgets.call(this, guiAction);
}

TataPanel.prototype = new Widgets();

TataPanel.getAction = function(script) {
    if (isNull(script)) {
        return undefined;
    }
    var a = RGuiAction.getByScriptFile("scripts/" + script);
    return isNull(a) ? undefined : a;
};

TataPanel.onClicked = function(item, button) {
    var appWin = RMainWindowQt.getMainWindow();

    if (item.status === "missing") {
        QMessageBox.information(appWin, "Tata Panel",
            item.label + ": zatím není implementováno.\n\n" + item.note);
        return;
    }

    var action = TataPanel.getAction(item.script);
    if (isNull(action)) {
        EAction.handleUserWarning("Tata Panel: akce nenalezena: " + item.script);
        return;
    }
    action.slotTrigger();
    if (item.toggle === true) {
        button.checked = action.checked;
    }

    if (item.status === "partial") {
        EAction.handleUserMessage(item.label + ": " + item.note);
    }
};

TataPanel.createButton = function(item, parent) {
    var button = new QToolButton(parent);
    button.objectName = "TataPanel_" + item.label;
    button.text = item.label;
    button.toolButtonStyle = Qt.ToolButtonTextBesideIcon;
    button.autoRaise = item.status === "ok";
    button.iconSize = new QSize(20, 20);
    button.sizePolicy = new QSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed);
    button.checkable = item.toggle === true;

    var iconAction = TataPanel.getAction(isNull(item.icon) ? item.script : item.icon);
    if (!isNull(iconAction)) {
        button.icon = iconAction.icon;
    }

    var tip = item.label;
    var action = TataPanel.getAction(item.script);
    if (!isNull(action)) {
        tip += "\n" + action.text.replace("&", "");
        var shortcut = action.getShortcutsString(", ");
        if (!isNull(shortcut) && shortcut.length > 0) {
            tip += " (" + shortcut + ")";
        }
        if (item.toggle === true) {
            button.checked = action.checked;
            action.toggled.connect(function(checked) { button.checked = checked; });
        }
    }
    if (item.status === "missing") {
        tip += "\nNENÍ IMPLEMENTOVÁNO";
    }
    if (!isNull(item.note)) {
        tip += "\n" + item.note;
    }
    button.toolTip = tip;

    if (!RSettings.hasCustomStyleSheet()) {
        if (item.status === "missing") {
            button.styleSheet = TataPanel.styleMissing;
        }
        else if (item.status === "partial") {
            button.styleSheet = TataPanel.stylePartial;
        }
    }

    button.clicked.connect(function() { TataPanel.onClicked(item, button); });
    return button;
};

/**
 * Shows, raises or hides the panel (same behavior as the layer list).
 */
TataPanel.prototype.beginEvent = function() {
    Widgets.prototype.beginEvent.call(this);

    var dock = RMainWindowQt.getMainWindow().findChild("TataPanelDock");
    if (!isNull(dock)) {
        if (!dock.visible) {
            dock.visible = true;
            dock.raise();
        }
        else if (dock.visibleRegion().isEmpty()) {
            dock.raise();
        }
        else {
            dock.visible = false;
        }
    }
    this.terminate();
};

TataPanel.prototype.finishEvent = function() {
    Widgets.prototype.finishEvent.call(this);
    var dock = RMainWindowQt.getMainWindow().findChild("TataPanelDock");
    if (!isNull(dock)) {
        this.getGuiAction().setChecked(dock.visible);
    }
};

TataPanel.init = function(basePath) {
    var appWin = RMainWindowQt.getMainWindow();

    var action = new RGuiAction("Tata Panel", appWin);
    action.setRequiresDocument(false);
    action.setScriptFile(basePath + "/TataPanel.js");
    action.setDefaultShortcut(new QKeySequence("t,p"));
    action.setDefaultCommands(["tatapanel", "tp"]);
    action.setGroupSortOrder(3600);
    action.setSortOrder(50);
    action.setWidgetNames(["ViewMenu", "WidgetsToolBar", "ViewToolsPanel", "WidgetMatrixPanel"]);

    var dock = new RDockWidget("Tata Panel", appWin);
    dock.objectName = "TataPanelDock";
    appWin.addDockWidget(Qt.LeftDockWidgetArea, dock);

    dock.shown.connect(function() { action.setChecked(true); });
    dock.hidden.connect(function() { action.setChecked(false); });
};

// Buttons are built in postInit because actions from folders loaded after
// Widgets/ (e.g. Misc/) do not exist yet during init.
TataPanel.postInit = function(basePath) {
    var appWin = RMainWindowQt.getMainWindow();
    var dock = appWin.findChild("TataPanelDock");
    if (isNull(dock)) {
        return;
    }

    var scroll = new QScrollArea(dock);
    scroll.widgetResizable = true;
    scroll.frameShape = QFrame.NoFrame;

    var content = new QWidget(scroll);
    content.objectName = "TataPanel";
    var vbox = new QVBoxLayout(content);
    vbox.setContentsMargins(4, 4, 4, 4);

    for (var s = 0; s < TataPanel.sections.length; s++) {
        var section = TataPanel.sections[s];
        var group = new QGroupBox(section.title, content);
        var grid = new QGridLayout(group);
        grid.setContentsMargins(4, 4, 4, 4);
        grid.setSpacing(2);
        for (var i = 0; i < section.items.length; i++) {
            var button = TataPanel.createButton(section.items[i], group);
            grid.addWidget(button, Math.floor(i / 2), i % 2);
        }
        vbox.addWidget(group);
    }
    vbox.addStretch(1);

    scroll.setWidget(content);
    dock.setWidget(scroll);
};

TataPanel.uninit = function() {
    var dock = RMainWindowQt.getMainWindow().findChild("TataPanelDock");
    if (!isNull(dock)) {
        destr(dock);
    }
};
