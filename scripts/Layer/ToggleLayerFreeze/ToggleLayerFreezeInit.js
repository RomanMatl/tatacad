function init(basePath) {
    var action = new RGuiAction(qsTranslate("ToggleLayerFreeze", "Toggle &Freeze"), RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/ToggleLayerFreeze.js");
    action.setDefaultShortcut(new QKeySequence("y,f"));
    action.setDefaultCommands(["layertogglefreeze", "layfrz", "yf"]);
    action.setGroupSortOrder(14100);
    action.setSortOrder(150);
    action.setWidgetNames(["LayerMenu", "LayerToolBar", "LayerToolsPanel", "LayerMatrixPanel"]);
}
