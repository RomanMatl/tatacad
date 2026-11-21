function init(basePath) {
    var action = new RGuiAction(qsTranslate("MultiLeader", "&Multileader"),
        RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/MultiLeader.js");
    action.setStatusTip(qsTranslate("MultiLeader", "Draw leader with landing and text"));
    action.setDefaultShortcut(new QKeySequence("d,m"));
    action.setDefaultCommands(["mleader", "multileader", "dm"]);
    action.setGroupSortOrder(12400);
    action.setSortOrder(200);
    action.setWidgetNames(["DimensionMenu", "DimensionToolBar", "DimensionToolsPanel", "DimensionMatrixPanel"]);
}
