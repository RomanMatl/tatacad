package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Install layout below the root folder:
//
//	versions/<version>/...   extracted packages
//	current.json             {"version": ..., "executable": ...}
//	downloads/               partial downloads
//	launcher.log
type Installer struct {
	Root     string
	Progress func(done, total int64)
}

type Current struct {
	Version    string `json:"version"`
	Executable string `json:"executable"`
}

func (in *Installer) versionsDir() string { return filepath.Join(in.Root, "versions") }

// Installed returns the installed version, or nil if none (or if it is broken).
func (in *Installer) Installed() *Current {
	data, err := os.ReadFile(filepath.Join(in.Root, "current.json"))
	if err != nil {
		return nil
	}
	var c Current
	if json.Unmarshal(data, &c) != nil || c.Version == "" || c.Executable == "" {
		return nil
	}
	if _, err := os.Stat(in.ExecutablePath(&c)); err != nil {
		return nil
	}
	return &c
}

func (in *Installer) ExecutablePath(c *Current) string {
	return filepath.Join(in.versionsDir(), c.Version, filepath.FromSlash(c.Executable))
}

// Install downloads, verifies and extracts the package of the given version
// and makes it the current version.
func (in *Installer) Install(version string, p Platform) (*Current, error) {
	if err := os.MkdirAll(filepath.Join(in.Root, "downloads"), 0o755); err != nil {
		return nil, err
	}
	tmpZip := filepath.Join(in.Root, "downloads", "tatacad-"+version+".zip")
	defer os.Remove(tmpZip)

	if err := in.download(p.URL, tmpZip, p.Size); err != nil {
		return nil, err
	}
	if p.SHA256 != "" {
		sum, err := fileSHA256(tmpZip)
		if err != nil {
			return nil, err
		}
		if !strings.EqualFold(sum, p.SHA256) {
			return nil, fmt.Errorf("checksum mismatch for %s: got %s, expected %s", p.URL, sum, p.SHA256)
		}
	}

	target := filepath.Join(in.versionsDir(), version)
	staging := target + ".partial"
	os.RemoveAll(staging)
	if err := extractZip(tmpZip, staging); err != nil {
		os.RemoveAll(staging)
		return nil, fmt.Errorf("extracting %s: %w", tmpZip, err)
	}
	c := &Current{Version: version, Executable: p.Executable}
	if _, err := os.Stat(filepath.Join(staging, filepath.FromSlash(p.Executable))); err != nil {
		os.RemoveAll(staging)
		return nil, fmt.Errorf("package does not contain %s", p.Executable)
	}
	os.RemoveAll(target)
	if err := os.Rename(staging, target); err != nil {
		return nil, err
	}
	if err := in.setCurrent(c); err != nil {
		return nil, err
	}
	return c, nil
}

func (in *Installer) setCurrent(c *Current) error {
	data, _ := json.MarshalIndent(c, "", "  ")
	tmp := filepath.Join(in.Root, "current.json.tmp")
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(in.Root, "current.json"))
}

// Prune removes all versions except the current one and the newest older
// one (kept as a fallback). Versions still in use (Windows locks running
// files) are skipped silently.
func (in *Installer) Prune(current string) {
	entries, err := os.ReadDir(in.versionsDir())
	if err != nil {
		return
	}
	var old []string
	for _, e := range entries {
		name := e.Name()
		if !e.IsDir() || name == current {
			continue
		}
		if strings.HasSuffix(name, ".partial") {
			os.RemoveAll(filepath.Join(in.versionsDir(), name))
			continue
		}
		old = append(old, name)
	}
	sort.Slice(old, func(i, j int) bool { return compareVersions(old[i], old[j]) > 0 })
	for i, v := range old {
		if i == 0 {
			continue
		}
		os.RemoveAll(filepath.Join(in.versionsDir(), v))
	}
}

func (in *Installer) download(url, dest string, size int64) error {
	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download %s: HTTP %d", url, resp.StatusCode)
	}
	total := resp.ContentLength
	if total <= 0 {
		total = size
	}
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()

	buf := make([]byte, 256*1024)
	var done int64
	last := time.Time{}
	for {
		n, rerr := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := f.Write(buf[:n]); werr != nil {
				return werr
			}
			done += int64(n)
			if in.Progress != nil && time.Since(last) > 250*time.Millisecond {
				in.Progress(done, total)
				last = time.Now()
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			return rerr
		}
	}
	if in.Progress != nil {
		in.Progress(done, total)
	}
	return f.Close()
}

func fileSHA256(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// extractZip extracts src into dest, keeping file modes and symlinks (the
// Qt frameworks in a macOS bundle rely on both).
func extractZip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	destAbs, err := filepath.Abs(dest)
	if err != nil {
		return err
	}
	for _, f := range r.File {
		// Windows PowerShell's Compress-Archive stores "\" separators:
		f.Name = strings.ReplaceAll(f.Name, "\\", "/")
		// AppleDouble metadata (extended attributes) would break the
		// signature seal of a macOS bundle:
		if strings.HasPrefix(f.Name, "__MACOSX/") || strings.HasPrefix(filepath.Base(f.Name), "._") {
			continue
		}
		path := filepath.Join(destAbs, filepath.FromSlash(f.Name))
		if path != destAbs && !strings.HasPrefix(path, destAbs+string(os.PathSeparator)) {
			return fmt.Errorf("illegal path in archive: %s", f.Name)
		}
		mode := f.Mode()
		switch {
		case f.FileInfo().IsDir():
			if err := os.MkdirAll(path, 0o755); err != nil {
				return err
			}
		case mode&os.ModeSymlink != 0:
			if err := extractSymlink(f, path, destAbs); err != nil {
				return err
			}
		default:
			if err := extractFile(f, path, mode); err != nil {
				return err
			}
		}
	}
	return nil
}

func extractSymlink(f *zip.File, path, destAbs string) error {
	rc, err := f.Open()
	if err != nil {
		return err
	}
	target, err := io.ReadAll(rc)
	rc.Close()
	if err != nil {
		return err
	}
	t := string(target)
	resolved := filepath.Join(filepath.Dir(path), t)
	if filepath.IsAbs(t) || !strings.HasPrefix(resolved, destAbs) {
		return fmt.Errorf("symlink %s points outside the package: %s", f.Name, t)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	os.Remove(path)
	return os.Symlink(t, path)
}

func extractFile(f *zip.File, path string, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()
	perm := mode.Perm()
	if perm == 0 {
		perm = 0o644
	}
	out, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, perm|0o200)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, rc); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

// lock prevents two launchers from installing at the same time.
// A lock older than 30 minutes is considered stale.
func (in *Installer) lock() (func(), error) {
	path := filepath.Join(in.Root, "install.lock")
	for i := 0; i < 2; i++ {
		f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
		if err == nil {
			f.Close()
			return func() { os.Remove(path) }, nil
		}
		if !errors.Is(err, os.ErrExist) {
			return nil, err
		}
		if st, serr := os.Stat(path); serr == nil && time.Since(st.ModTime()) > 30*time.Minute {
			os.Remove(path)
			continue
		}
		return nil, errors.New("another TataCAD launcher is installing an update")
	}
	return nil, errors.New("cannot acquire install lock")
}
