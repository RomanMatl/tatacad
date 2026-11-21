include("scripts/Draw/Line/Line2P/Line2P.js");

/**
 * AutoCAD-style XLINE: infinite construction lines through a base point and
 * a direction point. Same as Line2P, but always starts in XLine mode and keeps
 * its own option settings.
 */
function XLine2P(guiAction) {
    Line2P.call(this, guiAction);
    this.setUiOptions(["../Line.ui", "../Line2P/Line2P.ui"]);
}

XLine2P.prototype = new Line2P();

XLine2P.prototype.initUiOptions = function(resume, optionsToolBar, forDialog) {
    this.settingsGroup = "XLine2P";
    if (!resume) {
        RSettings.setValue("XLine2P/Type", Line.LineType.XLine);
    }
    Line2P.prototype.initUiOptions.call(this, resume, optionsToolBar, forDialog);
};
