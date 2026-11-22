package main

import (
	"errors"
	"fmt"
	"io"
	"log"
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
	procSetConsoleCP = kernel32.NewProc("SetConsoleOutputCP")
	procShellExecW   = syscall.NewLazyDLL("shell32.dll").NewProc("ShellExecuteW")
)

func platformDefaultRoot() string {
	if d := os.Getenv("LOCALAPPDATA"); d != "" {
		return filepath.Join(d, "TataCAD")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "AppData", "Local", "TataCAD")
}

const (
	errorAccessDisabledByPolicy = syscall.Errno(1260)
	errorIntegrityPolicyBlocked = syscall.Errno(4551)
)

// reportLaunchError explains a start blocked by Smart App Control or an
// application control policy and offers to open the Windows Security page
// where the user can change it; the launcher never changes it itself.
func reportLaunchError(exe string, err error) {
	if !errors.Is(err, errorIntegrityPolicyBlocked) && !errors.Is(err, errorAccessDisabledByPolicy) &&
		!strings.Contains(err.Error(), "Application Control") {
		fatal(fmt.Sprintf("Cannot start TataCAD: %v", err))
	}
	log.Printf("start blocked by application control: %v", err)
	msg := "Windows zablokoval spuštění TataCADu.\n\n" +
		"Obvykle to dělá Inteligentní řízení aplikací (Smart App Control), které pouští " +
		"jen aplikace podepsané certifikátem. TataCAD zatím podepsaný není. Na firemním " +
		"počítači to může být i politika nastavená správcem.\n\n" +
		"Otevřít Zabezpečení Windows > Řízení aplikací a prohlížeče? Tam lze v části " +
		"„Nastavení inteligentního řízení aplikací“ ochranu vypnout. Vypnutí je trvalé " +
		"a snižuje ochranu počítače. Potom spusťte TataCAD znovu zástupcem na ploše.\n\n" +
		"(" + err.Error() + ")"
	if askYesNo(msg) {
		openURL("windowsdefender://appbrowser")
	}
	os.Exit(1)
}

func askYesNo(msg string) bool {
	t, _ := syscall.UTF16PtrFromString("TataCAD")
	m, _ := syscall.UTF16PtrFromString(msg)
	const mbYesNo, mbIconWarning, idYes = 0x4, 0x30, 6
	r, _, _ := procMessageBoxW.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), mbYesNo|mbIconWarning)
	return r == idYes
}

func openURL(url string) {
	verb, _ := syscall.UTF16PtrFromString("open")
	u, _ := syscall.UTF16PtrFromString(url)
	const swShowNormal = 1
	if r, _, _ := procShellExecW.Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(u)), 0, 0, swShowNormal); r <= 32 {
		log.Printf("cannot open %s (ShellExecute %d)", url, r)
	}
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
		const cpUTF8 = 65001
		procSetConsoleCP.Call(cpUTF8)
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
