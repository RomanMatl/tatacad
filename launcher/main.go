// TataCAD launcher: installs TataCAD on first start, updates it when the
// release manifest announces a newer version, then starts it.
//
// Without network access the installed version is started as is.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

// Set by the release workflow:
//
//	-ldflags "-X main.defaultManifestURL=https://raw.githubusercontent.com/<owner>/<repo>/master/release/manifest.json"
var defaultManifestURL = ""

var launcherVersion = "dev"

func platformKey() string {
	arch := runtime.GOARCH
	if arch == "amd64" {
		arch = "x64"
	}
	osName := runtime.GOOS
	if osName == "darwin" {
		osName = "macos"
	}
	return osName + "-" + arch
}

func defaultRoot() string {
	if r := os.Getenv("TATACAD_HOME"); r != "" {
		return r
	}
	return platformDefaultRoot()
}

func main() {
	manifestURL := flag.String("manifest", envOr("TATACAD_MANIFEST_URL", defaultManifestURL), "release manifest URL")
	root := flag.String("root", defaultRoot(), "installation folder")
	noLaunch := flag.Bool("no-launch", false, "install / update only, do not start TataCAD")
	check := flag.Bool("check", false, "print installed and available version, change nothing")
	showVersion := flag.Bool("version", false, "print the launcher version")
	waitPid := flag.Int("wait-pid", 0, "wait (up to 60 s) for this process to exit first; used by \"update and restart\" in TataCAD")
	flag.Parse()

	if *showVersion {
		fmt.Println(launcherVersion)
		return
	}
	if err := os.MkdirAll(*root, 0o755); err != nil {
		fatal(fmt.Sprintf("Cannot create %s: %v", *root, err))
	}
	logFile, err := os.OpenFile(filepath.Join(*root, "launcher.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err == nil {
		defer logFile.Close()
		log.SetOutput(io.MultiWriter(logFile, os.Stderr))
	}
	log.Printf("launcher %s, platform %s, root %s", launcherVersion, platformKey(), *root)

	if *waitPid > 0 {
		waitForExit(*waitPid, 60*time.Second)
	}

	in := &Installer{Root: *root}
	installed := in.Installed()

	var manifest *Manifest
	if *manifestURL == "" {
		log.Printf("no manifest URL configured, skipping update check")
	} else if manifest, err = fetchManifest(*manifestURL); err != nil {
		log.Printf("update check failed: %v", err)
	}

	if *check {
		printStatus(installed, manifest)
		return
	}

	if manifest != nil && needsInstall(installed, manifest) {
		installed = runInstall(in, installed, manifest)
	}

	if installed == nil {
		if manifest == nil {
			fatal("TataCAD is not installed yet and the update server cannot be reached.\nCheck the internet connection and try again.")
		}
		fatal("TataCAD could not be installed. Details: " + filepath.Join(*root, "launcher.log"))
	}
	in.Prune(installed.Version)

	platformSetup(*root)
	writeLauncherInfo(*root, *manifestURL)

	if *noLaunch {
		log.Printf("installed %s, not starting (-no-launch)", installed.Version)
		return
	}
	exe := in.ExecutablePath(installed)
	log.Printf("starting %s", exe)
	if err := launch(exe, flag.Args()); err != nil {
		fatal(launchErrorMessage(exe, err))
	}
}

func needsInstall(installed *Current, m *Manifest) bool {
	if _, ok := m.Platforms[platformKey()]; !ok {
		log.Printf("release %s has no package for %s", m.Version, platformKey())
		return false
	}
	return installed == nil || compareVersions(m.Version, installed.Version) > 0
}

// runInstall installs the manifest's version. On failure the previously
// installed version (may be nil) is returned so it can still be started.
func runInstall(in *Installer, installed *Current, m *Manifest) *Current {
	p := m.Platforms[platformKey()]
	ui := newProgressUI()
	defer ui.Close()

	unlock, err := in.lock()
	if err != nil {
		log.Printf("%v", err)
		return installed
	}
	defer unlock()

	if installed == nil {
		ui.Status(fmt.Sprintf("Installing TataCAD %s ...", m.Version))
	} else {
		ui.Status(fmt.Sprintf("Updating TataCAD %s to %s ...", installed.Version, m.Version))
	}
	in.Progress = ui.Progress
	c, err := in.Install(m.Version, p)
	if err != nil {
		log.Printf("install %s failed: %v", m.Version, err)
		if installed == nil {
			return nil
		}
		ui.Status("Update failed, starting the installed version.")
		return installed
	}
	log.Printf("installed %s", c.Version)
	ui.Status(fmt.Sprintf("TataCAD %s installed.", c.Version))
	return c
}

func printStatus(installed *Current, m *Manifest) {
	if installed == nil {
		fmt.Println("installed: none")
	} else {
		fmt.Println("installed:", installed.Version)
	}
	if m == nil {
		fmt.Println("available: unknown")
	} else {
		fmt.Println("available:", m.Version)
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func fatal(msg string) {
	log.Print(msg)
	showError(msg)
	os.Exit(1)
}

// LauncherInfo is read by TataCAD (Help > Check for Updates) to find the
// manifest and to restart itself through the launcher.
type LauncherInfo struct {
	Path     string `json:"path"`
	Manifest string `json:"manifest"`
	Version  string `json:"version"`
}

func writeLauncherInfo(root, manifestURL string) {
	info := LauncherInfo{Path: launcherPath(root), Manifest: manifestURL, Version: launcherVersion}
	data, _ := json.MarshalIndent(info, "", "  ")
	if err := os.WriteFile(filepath.Join(root, "launcher.json"), data, 0o644); err != nil {
		log.Printf("cannot write launcher.json: %v", err)
	}
}

func waitForExit(pid int, timeout time.Duration) {
	deadline := time.Now().Add(timeout)
	for processAlive(pid) && time.Now().Before(deadline) {
		time.Sleep(200 * time.Millisecond)
	}
}
