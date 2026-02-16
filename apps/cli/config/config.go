package config

import (
	"fmt"
	"os"

	"github.com/spf13/viper"
)

type Config struct {
	EntryFiles []string `mapstructure:"entry_files"`
	Extras     []string `mapstructure:"extras"`
	BaseDir    string   `mapstructure:"base_dir"`
}

func Load(configPath string) (*Config, error) {
	v := viper.New()

	if configPath != "" {
		v.SetConfigFile(configPath)
	} else {
		v.SetConfigName(".rhashup")
		v.SetConfigType("yml")
		v.AddConfigPath(".")
	}

	v.SetDefault("base_dir", ".")
	v.SetDefault("extras", []string{})
	v.SetDefault("entry_files", []string{})

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			if configPath != "" {
				return nil, fmt.Errorf("failed to read config %s: %w", configPath, err)
			}
			// Config file not found is OK when not explicitly specified
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	return &cfg, nil
}

func ResolveBaseDir(baseDir string) string {
	if baseDir == "" {
		baseDir = "."
	}
	abs, err := os.Getwd()
	if err != nil {
		return baseDir
	}
	if baseDir == "." {
		return abs
	}
	if !isAbs(baseDir) {
		return abs + "/" + baseDir
	}
	return baseDir
}

func isAbs(path string) bool {
	return len(path) > 0 && path[0] == '/'
}
