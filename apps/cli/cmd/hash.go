package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"

	"github.com/maastrich/rhashup/apps/cli/config"
	wasmrt "github.com/maastrich/rhashup/apps/cli/wasm"
	"github.com/spf13/cobra"
)

var (
	extras  []string
	baseDir string
)

// wasmBinary is set from main.go via SetWasmBinary (embedded there).
var wasmBinary []byte

func SetWasmBinary(b []byte) {
	wasmBinary = b
}

var hashCmd = &cobra.Command{
	Use:   "hash [files...]",
	Short: "Hash files with their transitive imports",
	Args:  cobra.ArbitraryArgs,
	RunE:  runHash,
}

func init() {
	hashCmd.Flags().StringSliceVar(&extras, "extras", nil, "extra strings to include in the hash")
	hashCmd.Flags().StringVar(&baseDir, "base-dir", "", "base directory for import resolution")
	rootCmd.AddCommand(hashCmd)
}

func runHash(cmd *cobra.Command, args []string) error {
	cfg, err := config.Load(configPath)
	if err != nil {
		return err
	}

	// CLI args override config
	entryFiles := args
	if len(entryFiles) == 0 {
		entryFiles = cfg.EntryFiles
	}
	if len(entryFiles) == 0 {
		return fmt.Errorf("no entry files specified (provide as args or in config)")
	}

	if len(extras) == 0 {
		extras = cfg.Extras
	}

	resolvedBaseDir := baseDir
	if resolvedBaseDir == "" {
		resolvedBaseDir = cfg.BaseDir
	}
	resolvedBaseDir = config.ResolveBaseDir(resolvedBaseDir)

	// Make entry files absolute
	absEntryFiles := make([]string, len(entryFiles))
	for i, f := range entryFiles {
		if !filepath.IsAbs(f) {
			abs, err := filepath.Abs(f)
			if err != nil {
				return fmt.Errorf("failed to resolve path %s: %w", f, err)
			}
			absEntryFiles[i] = abs
		} else {
			absEntryFiles[i] = f
		}
	}

	if wasmBinary == nil {
		return fmt.Errorf("WASM binary not embedded; build with proper embed directive")
	}

	rt := wasmrt.NewRuntime(wasmBinary)
	result, err := rt.Hash(context.Background(), wasmrt.HashupOptions{
		EntryFiles: absEntryFiles,
		Extras:     extras,
		BaseDir:    resolvedBaseDir,
	})
	if err != nil {
		return err
	}

	switch format {
	case "json":
		out, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			return err
		}
		fmt.Println(string(out))
	case "text":
		fmt.Println(result.Hash)
	default:
		return fmt.Errorf("unknown format: %s", format)
	}

	return nil
}
