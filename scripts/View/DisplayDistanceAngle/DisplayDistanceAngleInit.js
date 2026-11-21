function init(basePath) {
    var action = new RGuiAction(qsTranslate("DisplayDistanceAngle", "Display &Distance/Angle"), RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/DisplayDistanceAngle.js");
    // F8 is taken by Snap/ToggleOrtho (AutoCAD convention).
    action.setNoState(true);
    action.setOverride();
    action.checkable = false;
    action.setGroupSortOrder(3980);
    action.setSortOrder(100);
    action.setWidgetNames(["ViewMenu", "!ViewToolBar", "!ViewToolsPanel"]);
}
