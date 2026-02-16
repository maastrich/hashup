package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var (
	configPath string
	format     string
)

var rootCmd = &cobra.Command{
	Use:   "rhashup",
	Short: "Deterministic file hashing with transitive import resolution",
	Long:  "rhashup hashes a file and all its transitive imports deterministically, supporting JS/TS, Python, Rust, and Go.",
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&configPath, "config", "", "config file (default: .rhashup.yml)")
	rootCmd.PersistentFlags().StringVar(&format, "format", "json", "output format: json or text")
}
