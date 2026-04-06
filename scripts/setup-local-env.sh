#!/usr/bin/env bash

set -eu

target_file=".env.local"

if [ -f "$target_file" ]; then
  printf '%s\n' "$target_file already exists. Edit it directly if you want to change values."
  exit 0
fi

cp ".env.example" "$target_file"
printf '%s\n' "Created $target_file from .env.example"
printf '%s\n' "Edit $target_file and set OPENAI_API_KEY / OPENAI_MODEL before running Code Orb."
