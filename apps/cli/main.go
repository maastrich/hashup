package main

import (
	_ "embed"

	"github.com/maastrich/rhashup/apps/cli/cmd"
)

//go:embed rhashup.wasm
var wasmBinary []byte

func main() {
	cmd.SetWasmBinary(wasmBinary)
	cmd.Execute()
}
