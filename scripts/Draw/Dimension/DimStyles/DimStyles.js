include("scripts/EAction.js");

/**
 * Named dimension styles. A style is a snapshot of the drawing's dimension
 * settings (Drawing Preferences > Dimension Settings), kept in the user
 * settings so it can be applied to any drawing.
 */
function DimStyles(guiAction) {
    EAction.call(this, guiAction);
}

DimStyles.prototype = new EAction();
DimStyles.includeBasePath = includeBasePath;

DimStyles.settingsKey = "TataDimStyles/Styles";

// [name, key, type]
DimStyles.vars = [
    ["DIMTXT", RS.DIMTXT, "double"],
    ["DIMEXE", RS.DIMEXE, "double"],
    ["DIMEXO", RS.DIMEXO, "double"],
    ["DIMGAP", RS.DIMGAP, "double"],
    ["DIMASZ", RS.DIMASZ, "double"],
    ["DIMSCALE", RS.DIMSCALE, "double"],
    ["DIMDLI", RS.DIMDLI, "double"],
    ["DIMTSZ", RS.DIMTSZ, "double"],
    ["DIMTAD", RS.DIMTAD, "int"],
    ["DIMTIH", RS.DIMTIH, "bool"],
    ["DIMDSEP", RS.DIMDSEP, "int"],
    ["DIMLUNIT", RS.DIMLUNIT, "int"],
    ["DIMDEC", RS.DIMDEC, "int"],
    ["DIMAUNIT", RS.DIMAUNIT, "int"],
    ["DIMADEC", RS.DIMADEC, "int"],
    ["DIMZIN", RS.DIMZIN, "int"],
    ["DIMAZIN", RS.DIMAZIN, "int"],
    ["DIMCLRT", RS.DIMCLRT, "color"]
];

DimStyles.presets = {
    "ISO-25": { DIMTXT: 2.5, DIMASZ: 2.5, DIMEXE: 1.25, DIMEXO: 0.625, DIMGAP: 0.625, DIMDLI: 3.75,
                DIMTSZ: 0, DIMTAD: 1, DIMTIH: false, DIMLUNIT: 2, DIMDEC: 2, DIMDSEP: 44, DIMZIN: 8, DIMAZIN: 2 },
    "ČSN 3,5": { DIMTXT: 3.5, DIMASZ: 3, DIMEXE: 2, DIMEXO: 1, DIMGAP: 1, DIMDLI: 7,
                 DIMTSZ: 0, DIMTAD: 1, DIMTIH: false, DIMLUNIT: 2, DIMDEC: 1, DIMDSEP: 44, DIMZIN: 8, DIMAZIN: 2 },
    "Architektonický": { DIMTXT: 2.5, DIMASZ: 2, DIMEXE: 1.5, DIMEXO: 1, DIMGAP: 0.8, DIMDLI: 5,
                         DIMTSZ: 2, DIMTAD: 1, DIMTIH: false, DIMLUNIT: 2, DIMDEC: 0, DIMDSEP: 44, DIMZIN: 8, DIMAZIN: 2 }
};

DimStyles.load = function() {
    var json = RSettings.getStringValue(DimStyles.settingsKey, "");
    if (json.length === 0) {
        return JSON.parse(JSON.stringify(DimStyles.presets));
    }
    try {
        return JSON.parse(json);
    }
    catch (e) {
        return {};
    }
};

DimStyles.store = function(styles) {
    RSettings.setValue(DimStyles.settingsKey, JSON.stringify(styles));
};

/**
 * \return Plain object with the current dimension settings of the document.
 */
DimStyles.capture = function(doc) {
    var dimStyle = doc.queryDimStyle();
    var ret = { font: doc.getDimensionFont() };
    for (var i = 0; i < DimStyles.vars.length; i++) {
        var v = DimStyles.vars[i];
        switch (v[2]) {
        case "double": ret[v[0]] = dimStyle.getDouble(v[1]); break;
        case "int": ret[v[0]] = dimStyle.getInt(v[1]); break;
        case "bool": ret[v[0]] = dimStyle.getBool(v[1]); break;
        case "color":
            var c = dimStyle.getColor(v[1]);
            ret[v[0]] = c.isByBlock() ? "ByBlock" : (c.isByLayer() ? "ByLayer" : c.name());
            break;
        }
    }
    return ret;
};

DimStyles.toColor = function(s) {
    if (s === "ByBlock") {
        return new RColor(RColor.ByBlock);
    }
    if (s === "ByLayer") {
        return new RColor(RColor.ByLayer);
    }
    return new RColor(s);
};

/**
 * Applies a style to the document as one undoable transaction and updates
 * all existing dimensions.
 */
DimStyles.applyStyle = function(di, style) {
    var doc = di.getDocument();
    var dimStyle = doc.queryDimStyle();
    var transaction = new RTransaction(doc.getStorage(), qsTr("Apply dimension style"), true);

    for (var i = 0; i < DimStyles.vars.length; i++) {
        var v = DimStyles.vars[i];
        var value = style[v[0]];
        if (isNull(value)) {
            continue;
        }
        switch (v[2]) {
        case "double": dimStyle.setDouble(v[1], value); break;
        case "int": dimStyle.setInt(v[1], value); break;
        case "bool": dimStyle.setBool(v[1], value); break;
        case "color": dimStyle.setColor(v[1], DimStyles.toColor(value)); break;
        }
    }
    if (!isNull(style.font)) {
        doc.setDimensionFont(style.font, transaction);
    }
    transaction.addObject(dimStyle);
    dimStyle.updateDocumentVariables(transaction);

    var ids = doc.queryAllEntities(false, true);
    for (var k = 0; k < ids.length; k++) {
        var entity = doc.queryEntityDirect(ids[k]);
        if (!isDimensionEntity(entity) && !isToleranceEntity(entity) && !isLeaderEntity(entity)) {
            continue;
        }
        doc.removeFromSpatialIndex(entity);
        entity.update();
        doc.addToSpatialIndex(entity);
    }
    transaction.end();
    di.regenerateScenes();
};

DimStyles.describe = function(style) {
    if (isNull(style)) {
        return "";
    }
    var sep = style.DIMDSEP === 44 ? "," : ".";
    return qsTr("Text height: %1, arrow: %2%3, gap: %4, decimals: %5, decimal separator: '%6'")
        .arg(style.DIMTXT).arg(style.DIMASZ)
        .arg(style.DIMTSZ > 0 ? " " + qsTr("(tick)") : "")
        .arg(style.DIMGAP).arg(style.DIMDEC).arg(sep);
};

DimStyles.prototype.beginEvent = function() {
    EAction.prototype.beginEvent.call(this);
    this.showDialog();
    this.terminate();
};

DimStyles.prototype.showDialog = function() {
    var di = this.getDocumentInterface();
    var doc = this.getDocument();
    var dialog = WidgetFactory.createDialog(DimStyles.includeBasePath, "DimStylesDialog.ui");
    var w = getWidgets(dialog);
    var styles = DimStyles.load();

    var refresh = function(select) {
        w["Styles"].clear();
        var names = Object.keys(styles).sort();
        for (var i = 0; i < names.length; i++) {
            w["Styles"].addItem(names[i]);
            if (names[i] === select) {
                w["Styles"].setCurrentRow(i);
            }
        }
    };
    var selectedName = function() {
        var item = w["Styles"].currentItem();
        return isNull(item) ? undefined : item.text();
    };
    var message = function(text) {
        w["Message"].text = text;
    };

    w["Styles"].currentRowChanged.connect(function() {
        var name = selectedName();
        w["Details"].text = isNull(name) ? "" : DimStyles.describe(styles[name]);
        if (!isNull(name)) {
            w["Name"].text = name;
        }
    });
    w["Apply"].clicked.connect(function() {
        var name = selectedName();
        if (isNull(name)) {
            return;
        }
        DimStyles.applyStyle(di, styles[name]);
        message(qsTr("Style '%1' applied.").arg(name));
    });
    w["Delete"].clicked.connect(function() {
        var name = selectedName();
        if (isNull(name)) {
            return;
        }
        delete styles[name];
        DimStyles.store(styles);
        refresh();
        message(qsTr("Style '%1' deleted.").arg(name));
    });
    w["SaveCurrent"].clicked.connect(function() {
        var name = w["Name"].text.trim();
        if (name.length === 0) {
            message("<font color='red'>" + qsTr("Enter a style name.") + "</font>");
            return;
        }
        styles[name] = DimStyles.capture(doc);
        DimStyles.store(styles);
        refresh(name);
        message(qsTr("Current settings saved as '%1'.").arg(name));
    });
    w["EditCurrent"].clicked.connect(function() {
        var a = RGuiAction.getByScriptFile("scripts/Edit/DrawingPreferences/DrawingPreferences.js");
        if (!isNull(a)) {
            a.slotTrigger();
        }
    });

    refresh();
    DimStyles.store(styles);
    dialog.exec();
    destrDialog(dialog);
    EAction.activateMainWindow();
};
