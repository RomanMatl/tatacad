function init(basePath) {
    var action = new RGuiAction(qsTranslate("CenterMark", "&Center Mark"),
        RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/CenterMark.js");
    action.setStatusTip(qsTranslate("CenterMark", "Draw center mark / center lines of an arc or circle"));
    action.setDefaultShortcut(new QKeySequence("d,c"));
    action.setDefaultCommands(["dimcenter", "centermark", "dce"]);
    action.setGroupSortOrder(12300);
    action.setSortOrder(300);
    action.setWidgetNames(["DimensionMenu", "DimensionToolBar", "DimensionToolsPanel", "DimensionMatrixPanel"]);
}
