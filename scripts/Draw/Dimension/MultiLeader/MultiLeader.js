include("scripts/EAction.js");
include("scripts/Draw/Text/TextDialog/TextDialog.js");

/**
 * AutoCAD-style multileader: arrow point, landing point, then the text.
 * Produces a leader with a horizontal landing (dogleg) and a multi-line text
 * attached to the landing. Stored as a leader plus a text entity, since the
 * document model has no native MLEADER object.
 */
function MultiLeader(guiAction) {
    EAction.call(this, guiAction);
    this.arrowPoint = undefined;
    this.landingPoint = undefined;
}

MultiLeader.prototype = new EAction();

MultiLeader.State = {
    SettingArrow : 0,
    SettingLanding : 1
};

MultiLeader.prototype.beginEvent = function() {
    EAction.prototype.beginEvent.call(this);
    this.setState(MultiLeader.State.SettingArrow);
};

MultiLeader.prototype.setState = function(state) {
    EAction.prototype.setState.call(this, state);
    this.getDocumentInterface().setClickMode(RAction.PickCoordinate);
    this.setCrosshairCursor();
    EAction.showSnapTools();

    var tr;
    if (this.state === MultiLeader.State.SettingArrow) {
        this.arrowPoint = undefined;
        this.landingPoint = undefined;
        tr = qsTr("Arrow point");
        this.setRightMouseTip(EAction.trCancel);
    }
    else {
        this.landingPoint = undefined;
        tr = qsTr("Landing point");
        this.setRightMouseTip(EAction.trBack);
    }
    this.setCommandPrompt(tr);
    this.setLeftMouseTip(tr);
};

MultiLeader.prototype.escapeEvent = function() {
    if (this.state === MultiLeader.State.SettingLanding) {
        this.setState(MultiLeader.State.SettingArrow);
        return;
    }
    EAction.prototype.escapeEvent.call(this);
};

MultiLeader.prototype.pickCoordinate = function(event, preview) {
    var di = this.getDocumentInterface();
    var pos = event.getModelPosition();

    if (this.state === MultiLeader.State.SettingArrow) {
        if (!preview) {
            this.arrowPoint = pos;
            di.setRelativeZero(pos);
            this.setState(MultiLeader.State.SettingLanding);
        }
        return;
    }

    this.landingPoint = pos;
    if (preview) {
        this.updatePreview();
        return;
    }

    var textData = new TextDialog(TextDialog.Mode.Text).show();
    if (isNull(textData)) {
        this.setState(MultiLeader.State.SettingArrow);
        return;
    }
    var op = this.getOperation(false, textData);
    if (!isNull(op)) {
        di.applyOperation(op);
    }
    this.setState(MultiLeader.State.SettingArrow);
};

MultiLeader.getDimVar = function(doc, key, def) {
    var v = doc.getKnownVariable(key, def);
    return isNumber(v) && v > 0 ? v : def;
};

/**
 * \param textData RTextData from the text dialog, undefined for the preview.
 */
MultiLeader.prototype.getOperation = function(preview, textData) {
    if (!isValidVector(this.arrowPoint) || !isValidVector(this.landingPoint)) {
        return undefined;
    }

    var doc = this.getDocument();
    var scale = MultiLeader.getDimVar(doc, RS.DIMSCALE, 1.0);
    var textHeight = MultiLeader.getDimVar(doc, RS.DIMTXT, 2.5) * scale;
    var gap = MultiLeader.getDimVar(doc, RS.DIMGAP, 0.625) * scale;
    var dogleg = MultiLeader.getDimVar(doc, RS.DIMASZ, 2.5) * scale;
    var dir = this.landingPoint.x >= this.arrowPoint.x ? 1 : -1;
    var doglegEnd = this.landingPoint.operator_add(new RVector(dir * dogleg, 0));

    var op = new RAddObjectsOperation();
    op.setText(this.getToolTitle());

    var leader = new RLeaderEntity(doc, new RLeaderData());
    leader.appendVertex(this.arrowPoint);
    leader.appendVertex(this.landingPoint);
    leader.appendVertex(doglegEnd);
    leader.setArrowHead(true);
    op.addObject(leader);

    if (!isNull(textData)) {
        var td = new RTextData(textData);
        if (!(td.getTextHeight() > 0)) {
            td.setTextHeight(textHeight);
        }
        var p = doglegEnd.operator_add(new RVector(dir * gap, 0));
        td.setAlignmentPoint(p);
        td.setPosition(p);
        td.setVAlign(RS.VAlignMiddle);
        td.setHAlign(dir > 0 ? RS.HAlignLeft : RS.HAlignRight);
        td.setAngle(0);
        op.addObject(new RTextEntity(doc, td));
    }
    return op;
};
