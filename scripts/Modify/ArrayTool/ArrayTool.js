include("../Transform.js");

/**
 * Rectangular (rows x columns) or polar (around a center point) array
 * of the current selection. The original entities stay in place and
 * count as the first item of the array.
 */
function ArrayTool(guiAction) {
    Transform.call(this, guiAction);

    this.polar = false;
    this.rows = 3;
    this.columns = 4;
    this.rowSpacing = 10;
    this.columnSpacing = 10;
    this.count = 6;
    this.fillAngle = 2 * Math.PI;
    this.rotateItems = true;
    this.centerPoint = undefined;
    this.copy = true;
}

ArrayTool.prototype = new Transform();
ArrayTool.includeBasePath = includeBasePath;

ArrayTool.State = {
    SettingCenterPoint : 0
};

ArrayTool.prototype.beginEvent = function() {
    Transform.prototype.beginEvent.call(this);

    if (!this.verifySelection()) {
        return;
    }

    if (!this.showDialog()) {
        this.terminate();
        return;
    }

    if (this.polar) {
        this.setState(ArrayTool.State.SettingCenterPoint);
        return;
    }

    this.apply();
};

ArrayTool.prototype.initState = function(state) {
    this.getDocumentInterface().setClickMode(RAction.PickCoordinate);
    this.setCrosshairCursor();

    var trCenter = qsTr("Center point of polar array");
    this.setCommandPrompt(trCenter);
    this.setLeftMouseTip(trCenter);
    this.setRightMouseTip(EAction.trCancel);
    EAction.showSnapTools();
};

ArrayTool.prototype.pickCoordinate = function(event, preview) {
    this.centerPoint = event.getModelPosition();
    if (preview) {
        var op = this.getOperation(true);
        if (!isNull(op)) {
            this.getDocumentInterface().previewOperation(op);
        }
        return;
    }
    this.getDocumentInterface().setRelativeZero(this.centerPoint);
    this.apply();
};

ArrayTool.prototype.apply = function() {
    var op = this.getOperation(false);
    if (!isNull(op)) {
        this.getDocumentInterface().applyOperation(op);
    }
    this.terminate();
};

ArrayTool.prototype.getItemCount = function() {
    return this.polar ? this.count : this.rows * this.columns;
};

ArrayTool.prototype.getOperation = function(preview, selectResult, cache) {
    this.copies = this.getItemCount() - 1;
    if (this.copies < 1) {
        return undefined;
    }
    if (this.polar && !isValidVector(this.centerPoint)) {
        return undefined;
    }
    return Transform.prototype.getOperation.call(this, preview, false, cache);
};

ArrayTool.prototype.getPolarStep = function() {
    // A full circle must not put the last item on top of the original:
    if (RMath.fuzzyCompare(Math.abs(this.fillAngle), 2 * Math.PI)) {
        return this.fillAngle / this.count;
    }
    return this.fillAngle / (this.count - 1);
};

ArrayTool.prototype.transform = function(entity, k, op, preview, flags) {
    if (this.polar) {
        var angle = this.getPolarStep() * k;
        if (this.rotateItems) {
            entity.rotate(angle, this.centerPoint);
        }
        else {
            var ref = entity.getBoundingBox().getCenter();
            entity.move(ref.getRotated(angle, this.centerPoint).operator_subtract(ref));
        }
    }
    else {
        var row = Math.floor(k / this.columns);
        var col = k % this.columns;
        entity.move(new RVector(col * this.columnSpacing, row * this.rowSpacing));
    }
    op.addObject(entity, flags);
};

ArrayTool.prototype.showDialog = function() {
    var dialog = WidgetFactory.createDialog(ArrayTool.includeBasePath, "ArrayDialog.ui");
    WidgetFactory.restoreState(dialog);
    if (!dialog.exec()) {
        destrDialog(dialog);
        EAction.activateMainWindow();
        return false;
    }

    var widgets = getWidgets(dialog);
    this.polar = widgets["Polar"].checked === true;
    this.rows = Math.max(1, widgets["Rows"].getValue());
    this.columns = Math.max(1, widgets["Columns"].getValue());
    this.rowSpacing = widgets["RowSpacing"].getValue();
    this.columnSpacing = widgets["ColumnSpacing"].getValue();
    this.count = Math.max(2, widgets["Count"].getValue());
    this.fillAngle = widgets["FillAngle"].getValue();
    this.rotateItems = widgets["RotateItems"].checked === true;
    this.useCurrentAttributes = widgets["UseCurrentAttributes"].checked === true;

    WidgetFactory.saveState(dialog);
    destrDialog(dialog);
    EAction.activateMainWindow();
    return true;
};
