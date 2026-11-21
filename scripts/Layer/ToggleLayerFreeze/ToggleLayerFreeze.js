include("scripts/Layer/Layer.js");

/**
 * Freezes / thaws the current layer, independent of its visibility (on/off).
 */
function ToggleLayerFreeze(guiAction) {
    Layer.call(this, guiAction);
}

ToggleLayerFreeze.prototype = new Layer();

ToggleLayerFreeze.prototype.beginEvent = function() {
    Layer.prototype.beginEvent.call(this);

    var layer = this.getCurrentLayer();
    if (isNull(layer)) {
        this.terminate();
        return;
    }

    layer.setFrozen(!layer.isFrozen());
    var op = new RModifyObjectsOperation();
    op.setTransactionType(RTransaction.LayerVisibilityStatusChange);
    op.addObject(layer);
    this.getDocumentInterface().applyOperation(op);

    EAction.handleUserMessage(layer.isFrozen()
        ? qsTr("Layer '%1' frozen").arg(layer.getName())
        : qsTr("Layer '%1' thawed").arg(layer.getName()));
    this.terminate();
};
