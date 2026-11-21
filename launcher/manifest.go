package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Manifest is release/manifest.json, written by the release workflow.
type Manifest struct {
	Version   string              `json:"version"`
	Released  string              `json:"released"`
	Commit    string              `json:"commit"`
	Platforms map[string]Platform `json:"platforms"`
}

// Platform is one downloadable package of a release.
type Platform struct {
	URL    string `json:"url"`
	SHA256 string `json:"sha256"`
	Size   int64  `json:"size"`
	// Path of the program inside the extracted package, e.g. "TataCAD/qcad.exe"
	// or "TataCAD.app".
	Executable string `json:"executable"`
}

func fetchManifest(url string) (*Manifest, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Cache-Control", "no-cache")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("manifest %s: HTTP %d", url, resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	var m Manifest
	if err := json.Unmarshal(body, &m); err != nil {
		return nil, fmt.Errorf("manifest %s: %w", url, err)
	}
	if m.Version == "" {
		return nil, fmt.Errorf("manifest %s: no version", url)
	}
	return &m, nil
}

// compareVersions compares dotted numeric versions ("27.0.7.12").
// Missing parts count as 0; non-numeric parts compare as strings.
func compareVersions(a, b string) int {
	pa := strings.Split(a, ".")
	pb := strings.Split(b, ".")
	for i := 0; i < len(pa) || i < len(pb); i++ {
		var sa, sb string
		if i < len(pa) {
			sa = pa[i]
		}
		if i < len(pb) {
			sb = pb[i]
		}
		na, ea := strconv.Atoi(orZero(sa))
		nb, eb := strconv.Atoi(orZero(sb))
		if ea == nil && eb == nil {
			if na != nb {
				if na < nb {
					return -1
				}
				return 1
			}
			continue
		}
		if c := strings.Compare(sa, sb); c != 0 {
			return c
		}
	}
	return 0
}

func orZero(s string) string {
	if s == "" {
		return "0"
	}
	return s
}
