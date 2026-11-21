function init(basePath) {
    var action = new RGuiAction(qsTranslate("Table", "T&able…"), RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/Table.js");
    action.setStatusTip(qsTranslate("Table", "Draw a table with optional cell texts"));
    action.setDefaultShortcut(new QKeySequence("t,b"));
    action.setDefaultCommands(["table", "tb"]);
    action.setGroupSortOrder(30);
    action.setSortOrder(200);
    action.setWidgetNames(["DrawMenu", "DrawToolBar", "MainToolsPanel", "DrawMatrixPanel"]);
}
