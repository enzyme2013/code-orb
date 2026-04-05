# Config Schema

## Purpose

This document defines the logical configuration surface before a concrete file format is finalized.

## Precedence

The intended precedence order is:

1. built-in defaults
2. user-level config
3. repository-level config
4. session or CLI overrides

Higher-precedence layers override lower-precedence layers.

## Initial Logical Fields

- model provider selection
- model name or profile
- safety policy mode
- working directory policy
- max tool retries
- verification command presets
- logging verbosity
- event artifact location

## Deliberately Deferred

The following are not decided yet:

- on-disk file format
- exact config file names
- environment variable mapping
- secrets handling

When these become concrete, record the decision in an ADR and update this document.
