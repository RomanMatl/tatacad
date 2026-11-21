/**
 * TataCAD: quick update check at startup when installed by the launcher.
 * The launcher already updates before starting TataCAD, so this only matters
 * when TataCAD runs for a long time or was started directly; it never blocks
 * with a dialog, it only leaves a note in the command line history.
 */
function postInit() {
    if (RSettings.hasQuitFlag()) {
        return;
    }
    if (RSettings.getBoolValue("CheckForUpdates/AutoCheckUpdates", true) !== true) {
        return;
    }

    include("CheckForUpdates.js");
    if (isNull(CheckForUpdates.getInstallation())) {
        return;
    }
    var r = CheckForUpdates.check(2000);
    if (r.status === "update") {
        EAction.handleUserMessage(
            qsTr("TataCAD %1 is available (installed: %2). Help > Check for Updates installs it.")
                .arg(r.available).arg(r.installed));
    }
}
