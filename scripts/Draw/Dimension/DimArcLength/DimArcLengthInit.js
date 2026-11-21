function init(basePath) {
    var action = new RGuiAction(qsTranslate("DimArcLength", "Arc &Length"),
        RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/DimArcLength.js");
    action.setStatusTip(qsTranslate("DimArcLength", "Draw arc length dimension"));
    action.setDefaultShortcut(new QKeySequence("d,g"));
    action.setDefaultCommands(["dimarc", "dimarclength", "dg"]);
    action.setGroupSortOrder(12300);
    action.setSortOrder(250);
    action.setWidgetNames(["DimensionMenu", "DimensionToolBar", "DimensionToolsPanel", "DimensionMatrixPanel"]);
}
