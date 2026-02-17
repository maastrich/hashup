package wasm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

type HashupOptions struct {
	EntryFiles []string `json:"entry_files"`
	Extras     []string `json:"extras,omitempty"`
	BaseDir    string   `json:"base_dir"`
}

type HashupResult struct {
	Hash  string   `json:"hash"`
	Files []string `json:"files"`
}

type Runtime struct {
	wasmBinary []byte
}

func NewRuntime(wasmBinary []byte) *Runtime {
	return &Runtime{wasmBinary: wasmBinary}
}

func (r *Runtime) Hash(ctx context.Context, opts HashupOptions) (*HashupResult, error) {
	inputJSON, err := json.Marshal(opts)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal options: %w", err)
	}

	stdin := bytes.NewReader(inputJSON)
	var stdout bytes.Buffer
	var stderr bytes.Buffer

	rc := wazero.NewRuntimeConfig()
	runtime := wazero.NewRuntimeWithConfig(ctx, rc)
	defer runtime.Close(ctx)

	wasi_snapshot_preview1.MustInstantiate(ctx, runtime)

	// Mount the base directory — all files (entry + transitive imports) live under it
	absBaseDir, _ := filepath.Abs(opts.BaseDir)
	fsConfig := wazero.NewFSConfig().WithDirMount(absBaseDir, absBaseDir)

	config := wazero.NewModuleConfig().
		WithStdin(stdin).
		WithStdout(&stdout).
		WithStderr(&stderr).
		WithFSConfig(fsConfig).
		WithArgs("rhashup-wasm")

	compiled, err := runtime.CompileModule(ctx, r.wasmBinary)
	if err != nil {
		return nil, fmt.Errorf("failed to compile WASM module: %w", err)
	}

	_, err = runtime.InstantiateModule(ctx, compiled, config)
	if err != nil {
		stderrStr := stderr.String()
		if stderrStr != "" {
			return nil, fmt.Errorf("WASM execution failed: %s", stderrStr)
		}
		return nil, fmt.Errorf("WASM execution failed: %w", err)
	}

	var result HashupResult
	if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
		return nil, fmt.Errorf("failed to parse WASM output: %w (output: %s)", err, stdout.String())
	}

	return &result, nil
}
