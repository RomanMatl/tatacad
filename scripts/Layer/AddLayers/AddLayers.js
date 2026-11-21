include("scripts/Layer/Layer.js");

/**
 * Adds N layers at once. Each row of the dialog sets name, color, linetype,
 * visibility and frozen state of one new layer.
 */
function AddLayers(guiAction) {
    Layer.call(this, guiAction);
}

AddLayers.prototype = new Layer();

AddLayers.defaultColors = ["red", "yellow", "green", "cyan", "blue", "magenta", "orange", "gray"];

AddLayers.prototype.beginEvent = function() {
    Layer.prototype.beginEvent.call(this);

    var layers = this.showDialog();
    if (!isNull(layers) && layers.length > 0) {
        var op = new RAddObjectsOperation();
        op.setText(this.getToolTitle());
        for (var i = 0; i < layers.length; i++) {
            op.addObject(layers[i], false);
        }
        this.getDocumentInterface().applyOperation(op);
        EAction.handleUserMessage(qsTr("%1 layer(s) added").arg(layers.length));
    }
    this.terminate();
};

AddLayers.prototype.getFreeName = function(prefix, start, taken) {
    var doc = this.getDocument();
    var n = start;
    var name;
    do {
        name = prefix + " " + n;
        n++;
    } while (doc.hasLayer(name) || taken.indexOf(name) !== -1);
    return name;
};

AddLayers.prototype.addRow = function(grid, rows, parent, prefix) {
    var doc = this.getDocument();
    var r = rows.length;
    var taken = [];
    for (var i = 0; i < rows.length; i++) {
        taken.push(rows[i].name.text);
    }

    var row = {};
    row.name = new QLineEdit(parent);
    row.name.text = this.getFreeName(prefix, r + 1, taken);
    row.name.minimumWidth = 140;

    row.color = new RColorCombo(parent);
    row.color.setOnlyFixed(true);
    row.color.init();
    row.color.setColor(new RColor(AddLayers.defaultColors[r % AddLayers.defaultColors.length]));

    row.linetype = new RLinetypeCombo(parent);
    row.linetype.setOnlyFixed(true);
    row.linetype.init(doc);
    var cont = doc.queryLinetype("CONTINUOUS");
    if (!isNull(cont)) {
        row.linetype.setLinetypePattern(cont.getPattern());
    }

    row.visible = new QCheckBox(parent);
    row.visible.checked = true;
    row.frozen = new QCheckBox(parent);
    row.frozen.checked = false;

    grid.addWidget(row.name, r + 1, 0);
    grid.addWidget(row.color, r + 1, 1);
    grid.addWidget(row.linetype, r + 1, 2);
    grid.addWidget(row.visible, r + 1, 3);
    grid.addWidget(row.frozen, r + 1, 4);
    rows.push(row);
};

AddLayers.prototype.removeRow = function(rows) {
    var row = rows.pop();
    destr(row.name);
    destr(row.color);
    destr(row.linetype);
    destr(row.visible);
    destr(row.frozen);
};

AddLayers.prototype.showDialog = function() {
    var self = this;
    var appWin = RMainWindowQt.getMainWindow();
    var doc = this.getDocument();

    var dialog = new QDialog(appWin);
    dialog.objectName = "AddLayersDialog";
    dialog.windowTitle = qsTr("Add Layers");
    dialog.minimumWidth = 640;
    dialog.minimumHeight = 360;
    var vbox = new QVBoxLayout(dialog);

    var top = new QWidget(dialog);
    var hbox = new QHBoxLayout(top);
    hbox.setContentsMargins(0, 0, 0, 0);
    hbox.addWidget(new QLabel(qsTr("Number of layers:"), top));
    var spin = new QSpinBox(top);
    spin.objectName = "Count";
    spin.minimum = 1;
    spin.maximum = 200;
    spin.value = RSettings.getIntValue("AddLayers/Count", 3);
    hbox.addWidget(spin);
    hbox.addWidget(new QLabel(qsTr("Name prefix:"), top));
    var prefixEdit = new QLineEdit(top);
    prefixEdit.objectName = "Prefix";
    prefixEdit.text = RSettings.getStringValue("AddLayers/Prefix", qsTr("Layer"));
    hbox.addWidget(prefixEdit);
    hbox.addStretch(1);
    vbox.addWidget(top);

    var scroll = new QScrollArea(dialog);
    scroll.widgetResizable = true;
    var content = new QWidget(scroll);
    var grid = new QGridLayout(content);
    var headers = [qsTr("Name"), qsTr("Color"), qsTr("Linetype"), qsTr("Visible"), qsTr("Frozen")];
    for (var h = 0; h < headers.length; h++) {
        grid.addWidget(new QLabel("<b>" + headers[h] + "</b>", content), 0, h);
    }
    grid.setRowStretch(201, 1);
    scroll.setWidget(content);
    vbox.addWidget(scroll);

    var message = new QLabel(dialog);
    vbox.addWidget(message);

    var buttons = new QWidget(dialog);
    var bbox = new QHBoxLayout(buttons);
    bbox.setContentsMargins(0, 0, 0, 0);
    bbox.addStretch(1);
    var ok = new QPushButton(qsTr("OK"), buttons);
    ok.objectName = "OK";
    ok.setDefault(true);
    var cancel = new QPushButton(qsTr("Cancel"), buttons);
    bbox.addWidget(ok);
    bbox.addWidget(cancel);
    vbox.addWidget(buttons);

    var rows = [];
    var sync = function() {
        while (rows.length < spin.value) {
            self.addRow(grid, rows, content, prefixEdit.text);
        }
        while (rows.length > spin.value) {
            self.removeRow(rows);
        }
    };
    sync();
    spin.valueChanged.connect(sync);

    var validate = function() {
        var names = [];
        for (var i = 0; i < rows.length; i++) {
            var name = rows[i].name.text.trim();
            if (name.length === 0 || doc.hasLayer(name) || names.indexOf(name.toLowerCase()) !== -1) {
                message.text = "<font color='red'>" + qsTr("Layer name '%1' is empty, already used or duplicated.").arg(name) + "</font>";
                return false;
            }
            names.push(name.toLowerCase());
        }
        return true;
    };
    ok.clicked.connect(function() {
        if (validate()) {
            dialog.accept();
        }
    });
    cancel.clicked.connect(function() { dialog.reject(); });

    var accepted = dialog.exec();
    var layers = [];
    if (accepted) {
        RSettings.setValue("AddLayers/Count", spin.value);
        RSettings.setValue("AddLayers/Prefix", prefixEdit.text);
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var lt = row.linetype.getLinetypePattern();
            var ltId = doc.getLinetypeId(lt.getName());
            var layer = new RLayer(doc, row.name.text.trim(), row.frozen.checked, false,
                                   row.color.getColor(), ltId,
                                   RSettings.getIntValue("Layer/DefaultLineweight", RLineweight.Weight025));
            layer.setOff(!row.visible.checked);
            layers.push(layer);
        }
    }

    destr(dialog);
    EAction.activateMainWindow();
    return layers;
};
