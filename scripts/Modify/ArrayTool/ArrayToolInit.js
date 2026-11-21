function init(basePath) {
    var action = new RGuiAction(qsTranslate("ArrayTool", "&Array…"), RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setRequiresSelection(true);
    action.setScriptFile(basePath + "/ArrayTool.js");
    action.setStatusTip(qsTranslate("ArrayTool", "Rectangular or polar array of the selection"));
    action.setDefaultShortcut(new QKeySequence("a,y"));
    action.setDefaultCommands(["array", "ay"]);
    action.setGroupSortOrder(13100);
    action.setSortOrder(150);
    action.setWidgetNames(["ModifyTransformMenu", "ModifyToolBar", "ModifyToolsPanel", "ModifyMatrixPanel"]);
}
