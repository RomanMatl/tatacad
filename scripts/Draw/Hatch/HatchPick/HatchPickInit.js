function init(basePath) {
    var action = new RGuiAction(qsTranslate("HatchPick", "Hatch by &Picking Point…"), RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/HatchPick.js");
    action.setStatusTip(qsTranslate("HatchPick", "Hatch a closed area by clicking inside it"));
    action.setDefaultShortcut(new QKeySequence("h,i"));
    action.setDefaultCommands(["bhatch", "hatchpick", "hi"]);
    action.setGroupSortOrder(11800);
    action.setSortOrder(150);
    action.setWidgetNames(["DrawHatchMenu", "HatchToolBar", "HatchToolsPanel", "HatchMatrixPanel"]);
}
