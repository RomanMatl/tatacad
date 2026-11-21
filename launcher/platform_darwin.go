package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

func platformDefaultRoot() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library", "Application Support", "TataCAD")
}

// launch opens the bundle with LaunchServices; extra args are files to open.
func launch(app string, args []string) error {
	cmdArgs := []string{"-n", app}
	if len(args) > 0 {
		cmdArgs = append(cmdArgs, "--args")
		cmdArgs = append(cmdArgs, args...)
	}
	return exec.Command("open", cmdArgs...).Run()
}

func platformSetup(root string) {}

func osascriptQuote(s string) string {
	return `"` + strings.ReplaceAll(strings.ReplaceAll(s, `\`, `\\`), `"`, `\"`) + `"`
}

func showError(msg string) {
	exec.Command("osascript", "-e",
		"display alert \"TataCAD\" message "+osascriptQuote(msg)+" as critical").Run()
}

type progressUI struct {
	lastPercent int64
}

func newProgressUI() *progressUI { return &progressUI{lastPercent: -1} }

func (p *progressUI) Status(msg string) {
	fmt.Println(msg)
	exec.Command("osascript", "-e",
		"display notification "+osascriptQuote(msg)+" with title \"TataCAD\"").Run()
}

func (p *progressUI) Progress(done, total int64) {
	if total <= 0 {
		return
	}
	pct := done * 100 / total
	if pct != p.lastPercent {
		fmt.Printf("\r%3d %% (%d / %d MB)", pct, done>>20, total>>20)
		p.lastPercent = pct
		if pct == 100 {
			fmt.Println()
		}
	}
}

func (p *progressUI) Close() {}

// launcherPath returns the launcher's .app bundle, or the binary if it does
// not run from a bundle.
func launcherPath(root string) string {
	self, err := os.Executable()
	if err != nil {
		return ""
	}
	if i := strings.Index(self, ".app/Contents/MacOS/"); i >= 0 {
		return self[:i+len(".app")]
	}
	return self
}

func processAlive(pid int) bool {
	return syscall.Kill(pid, 0) == nil
}
