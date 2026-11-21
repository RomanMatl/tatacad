function init(basePath) {
    var action = new RGuiAction(qsTranslate("XLine2P", "&Construction Line (XLine)"), RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/XLine2P.js");
    action.setStatusTip(qsTranslate("XLine2P", "Draw infinite construction lines through two points"));
    action.setDefaultShortcut(new QKeySequence("x,l"));
    action.setDefaultCommands(["xline", "xl"]);
    action.setGroupSortOrder(6100);
    action.setSortOrder(150);
    action.setWidgetNames(["DrawLineMenu", "LineToolBar", "LineToolsPanel", "LineMatrixPanel"]);
}
