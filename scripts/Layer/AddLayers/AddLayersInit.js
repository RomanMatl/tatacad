function init(basePath) {
    var action = new RGuiAction(qsTranslate("AddLayers", "Add &Multiple Layers…"), RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/AddLayers.js");
    action.setDefaultShortcut(new QKeySequence("y,m"));
    action.setDefaultCommands(["layeraddmultiple", "addlayers", "ym"]);
    action.setGroupSortOrder(14000);
    action.setSortOrder(150);
    action.setWidgetNames(["LayerMenu", "LayerToolBar", "LayerToolsPanel", "LayerMatrixPanel"]);
}
