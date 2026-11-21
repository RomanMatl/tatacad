package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"27.0.7.12", "27.0.7.9", 1},
		{"27.0.7.9", "27.0.7.12", -1},
		{"27.0.7", "27.0.7.0", 0},
		{"27.1.0.1", "27.0.9.99", 1},
		{"28.0.0.0", "27.9.9.9", 1},
	}
	for _, c := range cases {
		if got := compareVersions(c.a, c.b); got != c.want {
			t.Errorf("compareVersions(%q, %q) = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}

type entry struct {
	name    string
	body    string
	mode    fs.FileMode
	symlink bool
}

func makeZip(t *testing.T, entries []entry) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	for _, e := range entries {
		h := &zip.FileHeader{Name: e.name, Method: zip.Deflate}
		mode := e.mode
		if e.symlink {
			mode = fs.ModeSymlink | 0o777
		}
		h.SetMode(mode)
		f, err := w.CreateHeader(h)
		if err != nil {
			t.Fatal(err)
		}
		f.Write([]byte(e.body))
	}
	w.Close()
	return buf.Bytes()
}

func serve(t *testing.T, data []byte) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write(data)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func sum(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

func TestInstallAndUpdate(t *testing.T) {
	root := t.TempDir()
	in := &Installer{Root: root}
	if in.Installed() != nil {
		t.Fatal("fresh root reports an installed version")
	}

	v1 := makeZip(t, []entry{
		{name: "App/", mode: fs.ModeDir | 0o755},
		{name: "App/run", body: "#!/bin/sh\n", mode: 0o755},
		{name: "App/lib/libx.1.dylib", body: "lib", mode: 0o644},
		{name: "App/lib/libx.dylib", body: "libx.1.dylib", symlink: true},
	})
	srv := serve(t, v1)
	c, err := in.Install("1.0.0.1", Platform{URL: srv.URL, SHA256: sum(v1), Executable: "App/run"})
	if err != nil {
		t.Fatal(err)
	}
	if got := in.Installed(); got == nil || got.Version != "1.0.0.1" {
		t.Fatalf("installed = %+v", got)
	}
	exe := in.ExecutablePath(c)
	st, err := os.Stat(exe)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && st.Mode().Perm()&0o100 == 0 {
		t.Errorf("executable bit lost: %v", st.Mode())
	}
	if runtime.GOOS != "windows" {
		link := filepath.Join(root, "versions", "1.0.0.1", "App", "lib", "libx.dylib")
		if target, err := os.Readlink(link); err != nil || target != "libx.1.dylib" {
			t.Errorf("symlink: %q, %v", target, err)
		}
	}

	for _, v := range []string{"1.0.0.2", "1.0.0.3"} {
		data := makeZip(t, []entry{{name: "App/run", body: v, mode: 0o755}})
		srv := serve(t, data)
		if _, err := in.Install(v, Platform{URL: srv.URL, SHA256: sum(data), Executable: "App/run"}); err != nil {
			t.Fatal(err)
		}
	}
	in.Prune("1.0.0.3")
	entries, _ := os.ReadDir(filepath.Join(root, "versions"))
	var names []string
	for _, e := range entries {
		names = append(names, e.Name())
	}
	if len(names) != 2 || names[0] != "1.0.0.2" || names[1] != "1.0.0.3" {
		t.Errorf("after prune: %v, want current + one fallback", names)
	}
}

func TestChecksumMismatchKeepsInstalledVersion(t *testing.T) {
	root := t.TempDir()
	in := &Installer{Root: root}
	good := makeZip(t, []entry{{name: "App/run", body: "1", mode: 0o755}})
	if _, err := in.Install("1.0.0.1", Platform{URL: serve(t, good).URL, SHA256: sum(good), Executable: "App/run"}); err != nil {
		t.Fatal(err)
	}
	bad := makeZip(t, []entry{{name: "App/run", body: "2", mode: 0o755}})
	if _, err := in.Install("1.0.0.2", Platform{URL: serve(t, bad).URL, SHA256: sum(good), Executable: "App/run"}); err == nil {
		t.Fatal("expected checksum error")
	}
	if got := in.Installed(); got == nil || got.Version != "1.0.0.1" {
		t.Fatalf("installed after failed update = %+v", got)
	}
}

func TestZipSlipRejected(t *testing.T) {
	root := t.TempDir()
	in := &Installer{Root: root}
	evil := makeZip(t, []entry{{name: "../evil", body: "x", mode: 0o644}, {name: "App/run", body: "1", mode: 0o755}})
	if _, err := in.Install("1.0.0.1", Platform{URL: serve(t, evil).URL, Executable: "App/run"}); err == nil {
		t.Fatal("expected error for path outside the package")
	}
	if _, err := os.Stat(filepath.Join(root, "versions", "evil")); err == nil {
		t.Fatal("file written outside the package")
	}
}

func TestNeedsInstall(t *testing.T) {
	m := &Manifest{Version: "27.0.7.5", Platforms: map[string]Platform{platformKey(): {}}}
	if !needsInstall(nil, m) {
		t.Error("nothing installed should install")
	}
	if needsInstall(&Current{Version: "27.0.7.5"}, m) {
		t.Error("same version should not reinstall")
	}
	if !needsInstall(&Current{Version: "27.0.7.4"}, m) {
		t.Error("older version should update")
	}
	if needsInstall(nil, &Manifest{Version: "1", Platforms: map[string]Platform{"other-os": {}}}) {
		t.Error("no package for this platform should not install")
	}
}

func TestBackslashPaths(t *testing.T) {
	root := t.TempDir()
	in := &Installer{Root: root}
	data := makeZip(t, []entry{{name: "TataCAD\\qcad.exe", body: "exe", mode: 0o755}})
	if _, err := in.Install("1.0.0.1", Platform{URL: serve(t, data).URL, Executable: "TataCAD/qcad.exe"}); err != nil {
		t.Fatal(err)
	}
}
