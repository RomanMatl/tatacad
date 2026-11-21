/**
 * Copyright (c) 2011-2018 by Andrew Mustun. All rights reserved.
 *
 * This file is part of the QCAD project.
 *
 * QCAD is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * QCAD is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with QCAD.
 */

include("scripts/Help/Help.js");

/**
 * TataCAD: checks the release manifest used by the TataCAD launcher instead
 * of qcad.org. Updates are installed by the launcher; "Update and restart"
 * starts the launcher and quits TataCAD.
 *
 * Install layout written by the launcher (see launcher/):
 *   <root>/versions/<version>/...   this application
 *   <root>/launcher.json            {"path": launcher, "manifest": manifest URL}
 */
function CheckForUpdates(guiAction) {
    Help.call(this, guiAction);
}

CheckForUpdates.prototype = new Help();
CheckForUpdates.includeBasePath = includeBasePath;

/**
 * \return {root, version} when running from a launcher installation,
 * undefined otherwise (e.g. a development build).
 */
CheckForUpdates.getInstallation = function() {
    var dir = new QDir(RSettings.getApplicationPath());
    for (var i = 0; i < 6; i++) {
        var name = dir.dirName();
        if (!dir.cdUp()) {
            return undefined;
        }
        if (dir.dirName() === "versions") {
            var version = name;
            dir.cdUp();
            return { root: dir.absolutePath(), version: version };
        }
    }
    return undefined;
};

CheckForUpdates.readJson = function(fileName) {
    if (!new QFileInfo(fileName).exists()) {
        return undefined;
    }
    try {
        return JSON.parse(readTextFile(fileName));
    }
    catch (e) {
        return undefined;
    }
};

CheckForUpdates.compareVersions = function(a, b) {
    var pa = String(a).split(".");
    var pb = String(b).split(".");
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
        var na = parseInt(pa[i] || "0", 10);
        var nb = parseInt(pb[i] || "0", 10);
        if (na !== nb) {
            return na < nb ? -1 : 1;
        }
    }
    return 0;
};

/**
 * \return {status: "update"|"current"|"dev"|"error", installed, available, launcher, message}
 */
CheckForUpdates.check = function(timeout) {
    var inst = CheckForUpdates.getInstallation();
    if (isNull(inst)) {
        return { status: "dev", message: qsTr("This is a development build, it is not updated automatically.") };
    }
    var launcher = CheckForUpdates.readJson(inst.root + "/launcher.json");
    if (isNull(launcher) || isNull(launcher.manifest) || launcher.manifest === "") {
        return { status: "error", installed: inst.version, message: qsTr("Update server not configured (launcher.json missing).") };
    }
    var text = download(launcher.manifest, timeout);
    var manifest;
    try {
        manifest = JSON.parse(text);
    }
    catch (e) {
        manifest = undefined;
    }
    if (isNull(manifest) || isNull(manifest.version)) {
        return { status: "error", installed: inst.version, launcher: launcher,
                 message: qsTr("No connection to the update server. Please try again later.") };
    }
    var ret = { installed: inst.version, available: manifest.version, launcher: launcher };
    ret.status = CheckForUpdates.compareVersions(manifest.version, inst.version) > 0 ? "update" : "current";
    return ret;
};

/**
 * Starts the launcher (which waits for this process to exit, installs the
 * update and starts the new version) and quits.
 */
CheckForUpdates.updateAndRestart = function(launcher) {
    var process = new QProcess();
    var pid = String(QCoreApplication.applicationPid());
    if (RS.getSystemId() === "osx" && launcher.path.endsWith(".app")) {
        process.setProgram("open");
        process.setArguments(["-n", launcher.path, "--args", "-wait-pid", pid]);
    }
    else {
        process.setProgram(launcher.path);
        process.setArguments(["-wait-pid", pid]);
    }
    if (!process.startDetached()) {
        QMessageBox.warning(EAction.getMainWindow(), "TataCAD",
                            qsTr("Cannot start the launcher:") + "\n" + launcher.path);
        return;
    }
    var quit = RGuiAction.getByScriptFile("scripts/File/Quit/Quit.js");
    if (!isNull(quit)) {
        quit.slotTrigger();
    }
};

CheckForUpdates.prototype.beginEvent = function() {
    Help.prototype.beginEvent.call(this);

    var appWin = EAction.getMainWindow();
    var r = CheckForUpdates.check(10000);

    switch (r.status) {
    case "update":
        var answer = QMessageBox.question(appWin, qsTr("Update available"),
            qsTr("TataCAD %1 is available (installed: %2).\n\nUpdate now? TataCAD will close, install the update and start again.")
                .arg(r.available).arg(r.installed),
            makeQMessageBoxStandardButtons(QMessageBox.Yes, QMessageBox.No));
        if (answer === QMessageBox.Yes) {
            CheckForUpdates.updateAndRestart(r.launcher);
        }
        break;
    case "current":
        QMessageBox.information(appWin, qsTr("Up to date"),
            qsTr("TataCAD %1 is the latest version.").arg(r.installed));
        break;
    default:
        QMessageBox.information(appWin, "TataCAD", r.message);
        break;
    }

    EAction.activateMainWindow();
};
