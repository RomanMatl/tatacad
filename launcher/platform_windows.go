package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

var (
	kernel32         = syscall.NewLazyDLL("kernel32.dll")
	user32           = syscall.NewLazyDLL("user32.dll")
	procAllocConsole = kernel32.NewProc("AllocConsole")
	procFreeConsole  = kernel32.NewProc("FreeConsole")
	procMessageBoxW  = user32.NewProc("MessageBoxW")
	procOpenProcess  = kernel32.NewProc("OpenProcess")
	procWaitForObj   = kernel32.NewProc("WaitForSingleObject")
	procCloseHandle  = kernel32.NewProc("CloseHandle")
)

func platformDefaultRoot() string {
	if d := os.Getenv("LOCALAPPDATA"); d != "" {
		return filepath.Join(d, "TataCAD")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "AppData", "Local", "TataCAD")
}

func launch(exe string, args []string) error {
	cmd := exec.Command(exe, args...)
	cmd.Dir = filepath.Dir(exe)
	return cmd.Start()
}

// platformSetup copies the launcher into the installation folder and creates
// Start menu and desktop shortcuts to it, so later starts go through the
// launcher (and get updates) no matter where it was downloaded to.
func platformSetup(root string) {
	self, err := os.Executable()
	if err != nil {
		return
	}
	target := filepath.Join(root, "TataCAD.exe")
	if !strings.EqualFold(filepath.Clean(self), filepath.Clean(target)) {
		if copyFile(self, target) != nil {
			return
		}
	}
	startMenu := filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs", "TataCAD.lnk")
	desktop := filepath.Join(os.Getenv("USERPROFILE"), "Desktop", "TataCAD.lnk")
	for _, lnk := range []string{startMenu, desktop} {
		if _, err := os.Stat(lnk); err == nil {
			continue
		}
		createShortcut(lnk, target, root)
	}
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	tmp := dst + ".new"
	out, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	if err := out.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, dst)
}

func psQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}

func createShortcut(lnk, target, workDir string) {
	script := fmt.Sprintf(
		"$s=(New-Object -ComObject WScript.Shell).CreateShortcut(%s);$s.TargetPath=%s;$s.WorkingDirectory=%s;$s.Save()",
		psQuote(lnk), psQuote(target), psQuote(workDir))
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	cmd.Run()
}

func showError(msg string) {
	t, _ := syscall.UTF16PtrFromString("TataCAD")
	m, _ := syscall.UTF16PtrFromString(msg)
	const mbIconError = 0x10
	procMessageBoxW.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), mbIconError)
}

// progressUI opens a console window only while something is downloaded;
// normal starts show nothing (the launcher is built as a GUI program).
type progressUI struct {
	console     bool
	out         *os.File
	lastPercent int64
}

func newProgressUI() *progressUI {
	p := &progressUI{lastPercent: -1}
	if r, _, _ := procAllocConsole.Call(); r != 0 {
		if f, err := os.OpenFile("CONOUT$", os.O_WRONLY, 0); err == nil {
			p.console = true
			p.out = f
		}
	}
	return p
}

func (p *progressUI) Status(msg string) {
	if p.out != nil {
		fmt.Fprintln(p.out, msg)
	}
}

func (p *progressUI) Progress(done, total int64) {
	if p.out == nil || total <= 0 {
		return
	}
	pct := done * 100 / total
	if pct != p.lastPercent {
		fmt.Fprintf(p.out, "\r%3d %% (%d / %d MB)", pct, done>>20, total>>20)
		p.lastPercent = pct
		if pct == 100 {
			fmt.Fprintln(p.out)
		}
	}
}

func (p *progressUI) Close() {
	if p.out != nil {
		p.out.Close()
	}
	if p.console {
		procFreeConsole.Call()
	}
}

func launcherPath(root string) string {
	installed := filepath.Join(root, "TataCAD.exe")
	if _, err := os.Stat(installed); err == nil {
		return installed
	}
	self, _ := os.Executable()
	return self
}

func processAlive(pid int) bool {
	const synchronize = 0x00100000
	const waitTimeout = 0x102
	h, _, _ := procOpenProcess.Call(synchronize, 0, uintptr(pid))
	if h == 0 {
		return false
	}
	defer procCloseHandle.Call(h)
	r, _, _ := procWaitForObj.Call(h, 0)
	return r == waitTimeout
}
