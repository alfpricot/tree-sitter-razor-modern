# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2026-11-14)

### Breaking Changes

* **grammar:** parse code blocks as statements and code directives as members (#45)
* **grammar:** accept a line break before an event attribute equals and cap the index lookahead (#43)
* **grammar:** accept spaces around attribute equals and harden scanner lookahead (#42)
* **grammar:** widen leading text and accept null-conditional indexes (#37)
* **grammar:** drop generics from implicit expressions and add more forms (#33)
* **grammar:** parse switch labels as patterns and Blazor bind forms (#32)

### Bug Fixes

* **grammar:** accept void end tags, abrupt comments, and shared defaults (#36)
* **grammar:** accept more directive forms and text after directives (#31)
* **grammar:** parse void elements, raw script text, and html comments (#30)

## 0.1.2 (2026-10-29)

### Bug Fixes

* **deps:** require cc ~1.10 so the crate shares a lockfile (#26)

## 0.1.1 (2026-10-29)

### Bug Fixes

* **grammar:** accept an @ transition in directive attribute values (#24)

## [Unreleased]

## [0.1.0](https://github.com/meloncholera/tree-sitter-razor-modern/releases/tag/v0.1.0) - 2026-10-04

### Added

- parse real-world Razor pages and align CI and tooling ([#4](https://github.com/meloncholera/tree-sitter-razor-modern/pull/4))
- initial ASP.NET Core Razor grammar fork

### Fixed

- *(release)* start release-plz history at the fork's first commit ([#9](https://github.com/meloncholera/tree-sitter-razor-modern/pull/9))

### Other

- *(deps)* update eslint and node-gyp ([#6](https://github.com/meloncholera/tree-sitter-razor-modern/pull/6))
