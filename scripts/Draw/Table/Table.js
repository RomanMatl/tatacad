include("scripts/EAction.js");

/**
 * Table: rows x columns grid of lines with optional cell texts, placed by its
 * top left corner. The document model has no table object, so the result is
 * plain lines and texts (left selected so the table can be moved at once).
 */
function Table(guiAction) {
    EAction.call(this, guiAction);
    this.rows = 4;
    this.columns = 3;
    this.rowHeight = 8;
    this.columnWidth = 30;
    this.textHeight = 3.5;
    this.cells = [];
    this.position = undefined;
}

Table.prototype = new EAction();
Table.includeBasePath = includeBasePath;

Table.prototype.beginEvent = function() {
    EAction.prototype.beginEvent.call(this);

    if (!this.showDialog()) {
        this.terminate();
        return;
    }

    this.getDocumentInterface().setClickMode(RAction.PickCoordinate);
    this.setCrosshairCursor();
    var tr = qsTr("Top left corner of table");
    this.setCommandPrompt(tr);
    this.setLeftMouseTip(tr);
    this.setRightMouseTip(EAction.trCancel);
    EAction.showSnapTools();
};

Table.prototype.pickCoordinate = function(event, preview) {
    this.position = event.getModelPosition();
    if (preview) {
        this.updatePreview();
        return;
    }

    var op = this.getOperation(false);
    if (!isNull(op)) {
        var di = this.getDocumentInterface();
        di.clearSelection();
        di.applyOperation(op);
        di.setRelativeZero(this.position);
    }
    this.terminate();
};

Table.prototype.getOperation = function(preview) {
    if (!isValidVector(this.position)) {
        return undefined;
    }

    var doc = this.getDocument();
    var op = new RAddObjectsOperation();
    op.setText(this.getToolTitle());

    var x0 = this.position.x;
    var y0 = this.position.y;
    var w = this.columns * this.columnWidth;
    var h = this.rows * this.rowHeight;
    var add = function(entity) {
        entity.setSelected(!preview);
        op.addObject(entity);
    };

    for (var r = 0; r <= this.rows; r++) {
        var y = y0 - r * this.rowHeight;
        add(new RLineEntity(doc, new RLineData(new RVector(x0, y), new RVector(x0 + w, y))));
    }
    for (var c = 0; c <= this.columns; c++) {
        var x = x0 + c * this.columnWidth;
        add(new RLineEntity(doc, new RLineData(new RVector(x, y0), new RVector(x, y0 - h))));
    }

    for (var row = 0; row < this.rows; row++) {
        for (var col = 0; col < this.columns; col++) {
            var text = this.getCellText(row, col);
            if (text.length === 0) {
                continue;
            }
            var center = new RVector(x0 + (col + 0.5) * this.columnWidth, y0 - (row + 0.5) * this.rowHeight);
            var td = new RTextData(center, center, this.textHeight, 0,
                                   RS.VAlignMiddle, RS.HAlignCenter,
                                   RS.LeftToRight, RS.Exact, 1.0,
                                   text, "standard", row === 0, false, 0, true);
            add(new RTextEntity(doc, td));
        }
    }
    return op;
};

Table.prototype.getCellText = function(row, col) {
    if (isNull(this.cells[row]) || isNull(this.cells[row][col])) {
        return "";
    }
    return this.cells[row][col];
};

Table.prototype.showDialog = function() {
    var dialog = WidgetFactory.createDialog(Table.includeBasePath, "TableDialog.ui");
    WidgetFactory.restoreState(dialog, "Table");
    var widgets = getWidgets(dialog);
    var tw = widgets["Cells"];
    var sync = function() {
        tw.setRowCount(widgets["Rows"].value);
        tw.setColumnCount(widgets["Columns"].value);
    };
    sync();
    widgets["Rows"].valueChanged.connect(sync);
    widgets["Columns"].valueChanged.connect(sync);

    if (!dialog.exec()) {
        destrDialog(dialog);
        EAction.activateMainWindow();
        return false;
    }

    this.rows = widgets["Rows"].value;
    this.columns = widgets["Columns"].value;
    this.rowHeight = widgets["RowHeight"].getValue();
    this.columnWidth = widgets["ColumnWidth"].getValue();
    this.textHeight = widgets["TextHeight"].getValue();
    this.cells = [];
    for (var r = 0; r < this.rows; r++) {
        this.cells.push([]);
        for (var c = 0; c < this.columns; c++) {
            var item = tw.item(r, c);
            this.cells[r].push(isNull(item) ? "" : item.text().trim());
        }
    }

    WidgetFactory.saveState(dialog, "Table");
    destrDialog(dialog);
    EAction.activateMainWindow();
    return this.rows > 0 && this.columns > 0 && this.rowHeight > 0 && this.columnWidth > 0;
};
