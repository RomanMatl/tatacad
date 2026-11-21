function init(basePath) {
    var action = new RGuiAction(qsTranslate("DimStyles", "Dimension &Styles…"),
        RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/DimStyles.js");
    action.setStatusTip(qsTranslate("DimStyles", "Save, apply and manage named dimension styles"));
    action.setDefaultShortcut(new QKeySequence("d,y"));
    action.setDefaultCommands(["dimstyle", "dimstyles", "dy"]);
    action.setNoState(true);
    action.setGroupSortOrder(12500);
    action.setSortOrder(100);
    action.setWidgetNames(["DimensionMenu", "DimensionToolBar", "DimensionToolsPanel", "DimensionMatrixPanel"]);
}
