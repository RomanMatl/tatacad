include("scripts/Draw/Dimension/Dimension.js");

function DimArcLength(guiAction) {
    Dimension.call(this, guiAction);

    this.data = new RDimArcLengthData();
    this.setUiOptions("../Dimension.ui");
    this.entity = undefined;
    this.shape = undefined;
    this.pos = undefined;
}

DimArcLength.prototype = new Dimension();

DimArcLength.State = {
    SettingEntity : 0,
    SettingDimPos : 1
};

DimArcLength.prototype.beginEvent = function() {
    Dimension.prototype.beginEvent.call(this);
    this.setState(DimArcLength.State.SettingEntity);
};

DimArcLength.prototype.setState = function(state) {
    Dimension.prototype.setState.call(this, state);
    this.setCrosshairCursor();

    switch (this.state) {
    case DimArcLength.State.SettingEntity:
        this.getDocumentInterface().setClickMode(RAction.PickEntity);
        this.entity = undefined;
        this.shape = undefined;
        this.pos = undefined;
        var trEntity = qsTr("Choose arc");
        this.setCommandPrompt(trEntity);
        this.setLeftMouseTip(trEntity);
        this.setRightMouseTip(EAction.trCancel);
        break;

    case DimArcLength.State.SettingDimPos:
        this.getDocumentInterface().setClickMode(RAction.PickCoordinate);
        var trDimPos = qsTr("Dimension arc line location");
        this.setCommandPrompt(trDimPos);
        this.setLeftMouseTip(trDimPos);
        this.setRightMouseTip(EAction.trBack);
        EAction.showSnapTools();
        break;
    }
};

DimArcLength.prototype.escapeEvent = function() {
    if (this.state === DimArcLength.State.SettingDimPos) {
        this.setState(DimArcLength.State.SettingEntity);
        return;
    }
    EAction.prototype.escapeEvent.call(this);
};

DimArcLength.prototype.pickEntity = function(event, preview) {
    if (this.state !== DimArcLength.State.SettingEntity) {
        return;
    }

    var entity = this.getDocument().queryEntity(this.getEntityId(event, preview));
    if (isNull(entity)) {
        return;
    }

    var pos = event.getModelPosition();
    this.autoAdjustScale(pos);
    var shape = entity.getClosestSimpleShape(pos);
    if (!isArcShape(shape)) {
        if (!preview) {
            EAction.handleUserWarning(qsTr("Entity is not an arc."));
        }
        return;
    }

    this.entity = entity;
    this.shape = shape;

    if (preview) {
        this.updatePreview();
    }
    else {
        this.getDocumentInterface().setRelativeZero(shape.getCenter());
        this.setState(DimArcLength.State.SettingDimPos);
    }
};

DimArcLength.prototype.pickCoordinate = function(event, preview) {
    if (this.state !== DimArcLength.State.SettingDimPos) {
        return;
    }

    this.pos = event.getModelPosition();
    if (preview) {
        this.updatePreview();
        return;
    }

    var op = this.getOperation(false);
    if (!isNull(op)) {
        var di = this.getDocumentInterface();
        di.applyOperation(op);
        di.setRelativeZero(this.pos);
        this.setState(DimArcLength.State.SettingEntity);
    }
};

DimArcLength.prototype.getOperation = function(preview) {
    if (!isValidVector(this.pos) || isNull(this.shape)) {
        return undefined;
    }

    this.data.setCenter(this.shape.getCenter());
    // Arc length dimensions measure counter-clockwise from line 1 to line 2:
    if (this.shape.isReversed()) {
        this.data.setExtensionLine1End(this.shape.getEndPoint());
        this.data.setExtensionLine2End(this.shape.getStartPoint());
    }
    else {
        this.data.setExtensionLine1End(this.shape.getStartPoint());
        this.data.setExtensionLine2End(this.shape.getEndPoint());
    }
    this.data.setDimArcPosition(this.pos);
    this.data.setLinearFactor(this.getFactor());

    var entity = new RDimArcLengthEntity(this.getDocument(), this.data);
    if (!isEntity(entity)) {
        return undefined;
    }
    return new RAddObjectOperation(entity, this.getToolTitle());
};

DimArcLength.prototype.getHighlightedEntities = function() {
    return isEntity(this.entity) ? [this.entity.getId()] : [];
};
