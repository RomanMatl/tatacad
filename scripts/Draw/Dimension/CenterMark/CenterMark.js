include("scripts/EAction.js");

/**
 * AutoCAD-style center mark (DIMCENTER): a cross at the center of an arc or
 * circle and, optionally, center lines reaching past the circumference.
 * Drawn as plain line entities, like AutoCAD's classic DIMCENTER.
 */
function CenterMark(guiAction) {
    EAction.call(this, guiAction);

    this.size = 2.5;
    this.centerLines = true;
    this.shape = undefined;
    this.setUiOptions("CenterMark.ui");
}

CenterMark.prototype = new EAction();

CenterMark.State = {
    ChoosingEntity : 0
};

CenterMark.prototype.beginEvent = function() {
    EAction.prototype.beginEvent.call(this);
    this.setState(CenterMark.State.ChoosingEntity);
};

CenterMark.prototype.setState = function(state) {
    EAction.prototype.setState.call(this, state);

    this.getDocumentInterface().setClickMode(RAction.PickEntity);
    this.setCrosshairCursor();
    this.shape = undefined;
    var trEntity = qsTr("Choose arc or circle");
    this.setCommandPrompt(trEntity);
    this.setLeftMouseTip(trEntity);
    this.setRightMouseTip(EAction.trCancel);
};

CenterMark.prototype.pickEntity = function(event, preview) {
    var doc = this.getDocument();
    var entity = doc.queryEntity(this.getEntityId(event, preview));
    this.shape = undefined;
    if (isNull(entity)) {
        if (preview) {
            this.updatePreview();
        }
        return;
    }

    var shape = entity.getClosestSimpleShape(event.getModelPosition());
    if (!isArcShape(shape) && !isCircleShape(shape)) {
        if (!preview) {
            EAction.warnNotArcCircle();
        }
        return;
    }
    this.shape = shape;

    if (preview) {
        this.updatePreview();
        return;
    }

    var op = this.getOperation(false);
    if (!isNull(op)) {
        var di = this.getDocumentInterface();
        di.applyOperation(op);
        di.setRelativeZero(shape.getCenter());
    }
    this.shape = undefined;
};

CenterMark.getLines = function(center, radius, size, centerLines) {
    var lines = [];
    var cx = center.x, cy = center.y;
    lines.push(new RLine(new RVector(cx - size, cy), new RVector(cx + size, cy)));
    lines.push(new RLine(new RVector(cx, cy - size), new RVector(cx, cy + size)));

    var from = 2 * size;
    var to = radius + size;
    if (centerLines && to > from) {
        lines.push(new RLine(new RVector(cx + from, cy), new RVector(cx + to, cy)));
        lines.push(new RLine(new RVector(cx - from, cy), new RVector(cx - to, cy)));
        lines.push(new RLine(new RVector(cx, cy + from), new RVector(cx, cy + to)));
        lines.push(new RLine(new RVector(cx, cy - from), new RVector(cx, cy - to)));
    }
    return lines;
};

CenterMark.prototype.getOperation = function(preview) {
    if (isNull(this.shape) || !(this.size > 0)) {
        return undefined;
    }

    var doc = this.getDocument();
    var op = new RAddObjectsOperation();
    op.setText(this.getToolTitle());
    var lines = CenterMark.getLines(this.shape.getCenter(), this.shape.getRadius(), this.size, this.centerLines);
    for (var i = 0; i < lines.length; i++) {
        op.addObject(new RLineEntity(doc, new RLineData(lines[i])));
    }
    return op;
};

CenterMark.prototype.slotSizeChanged = function(value) {
    this.size = value;
};

CenterMark.prototype.slotCenterLinesChanged = function(checked) {
    this.centerLines = checked;
};
