## Introduction & Goals
This document defines the functional and architectural specifications for a desktop application—built on **Electron**—to manage sound patches and step-sequencer files for the Moog Muse synthesizer. The app's primary objectives are:
- **Patch Library Management**: Import, organize, rate, categorize, and export `.mmp` patch files in a USB-transferable directory layout.
- **Step-Sequencer Editor**: Visually display and edit 64-step MIDI sequences (`.mmseq`), including step toggling, note/velocity assignment (via mouse or MIDI controller), and import/export.

## User Personas & Use Cases
1. **Synth Enthusiast**
   - Wants to browse hundreds of patches, "♥" favorite ones, tag them (e.g. "ambient"), and deploy selected banks to the Muse.
2. **Live Performer**
   - Quickly builds or tweaks sequences on the fly, using a MIDI controller to set notes/velocities, then exports tuned sequences back to hardware.
3. **Sound Designer**
   - Applies free-form tags, groups patches into categories (bass, lead, pad, pluck, strings), and shares organized libraries with collaborators.

## Functional Requirements

### 1. Patch Management

#### Import
- Allow users to import patches from a selected directory
- Support for .mmp patch files
- Directory Structure:
  - Root directory (e.g., "MUSE-LIB-001 FACTORY")
    - Library/ (optional)
      - bank01/
        - bank.bank
        - patch01/
          - patch.mmp
        - patch02/
          - patch.mmp
      - bank02/
        - bank.bank
        - patch01/
          - patch.mmp
  - Each bank directory contains:
    - A .bank file (e.g., "bank.bank", "lead.bank")
    - Multiple patch directories (patch01, patch02, etc.)
  - Each patch directory contains:
    - One or more .mmp files
- Import Process:
  1. User selects a root directory
  2. If a "Library" folder exists, it is used as the root for scanning
  3. System scans for bank directories (starting with "bank")
  4. For each bank:
     - Reads the .bank file name
     - Scans for patch directories (starting with "patch")
     - Collects all .mmp files
  5. Patches are imported with:
     - Name derived from .mmp filename
     - Bank name from .bank file
     - Library name from root directory
     - Initial category set to bank name
- Display imported patches in a list with:
  - Patch name
  - Bank name
  - Library name
  - Category
  - Tags
  - Loved status

- **Organize & Search**
  - Present library view grouped by bank and category.
  - Filter by "Loved" (♥), category, and free-form tags.
- **Metadata Editing**
  - Toggle "Loved" (heart) on each patch.
  - Assign one of five fixed categories: Bass, Lead, Pad, Pluck, Strings.
  - Add/remove free-form tags.
- **Export**
  - Generate a directory tree matching Muse's USB layout:
    ```
    export-root/
    ├─ bank00/
    │   ├─ patch00/…patch.mmp
    │   └─ bank.bank
    ├─ bank01/…
    └─ sequences/…
    ```
  - Copy opaque `.mmp` blobs and manifest files.

### 2. Sequencer Editor
- **Import/Export**
  - Load `.mmseq` files from `library/sequences/bankXX/seqYY/`.
  - Serialize back to the same custom text format.
- **Visual Grid**
  - 8×8 grid (64 steps), each cell shows "on/off" status; click to toggle.
  - Right-click (or MIDI input) to assign Note (0–127) and Velocity (0–127).
- **Global Settings Panel**
  - Expose at least:
    - Length (1–64 steps)
    - BPM (e.g. 20.0–300.0)
    - ClockDiv
    - Direction (Forward/Reverse/Pendulum)
- **MIDI Controller Integration**
  - Listen via Web MIDI API (or Node MIDI lib) for note/velocity mapping to selected step.
- **Live Preview**
  - Optional playback of current sequence at set BPM for auditioning.

## Non-Functional Requirements
- **Platforms**: Electron packaging for macOS (primary), Windows, Linux.
- **Performance**:
  - Instant library navigation even with ~1,000 patches/sequences.
  - Sub-100 ms response for UI interactions.
- **Data Integrity**:
  - Backup or transactional writes when saving metadata or exporting.
  - Rollback on parse/serialization errors.
- **Security**:
  - Sandboxed file access.
  - No telemetry or external network calls without explicit consent.

## Architectural Overview
```
┌────────────────┐      ┌───────────────────┐      ┌────────────────┐
│   Renderer     │◀────▶│   Main Process    │◀────▶│   SQLite DB    │
│ (React + Web   │      │  (Node.js + APIs) │      │ (better-sqlite3)│
│  MIDI Bridge)  │      └───────────────────┘      └────────────────┘
└────────────────┘
         │
         ▼
   File I/O Module
(parse .mmseq; copy .mmp)
```

- **Renderer**
  - UI built with React (or Vue/Svelte), using Electron's `ipcRenderer` to communicate.
  - Web MIDI or Node MIDI integration for controller input.
- **Main Process**
  - Handles filesystem I/O, database access, CSV/text parsing/serialization.
  - Exposes IPC channels:
    - `loadLibrary()`, `saveMetadata()`, `exportLibrary()`
    - `loadSequence()`, `saveSequence()`
- **Persistence**
  - **SQLite** (via better-sqlite3) stores tables:
    - `patches(id, path, loved BOOLEAN, category TEXT, tags TEXT[])`
    - `sequences(id, path, lastModified)`

## Component Breakdown
1. **Patch Library Manager**
2. **Sequencer Grid Editor**
3. **Global Settings Panel**
4. **File Import/Export Module**
5. **Parser/Serializer** for `.mmseq`
6. **Persistence Layer** (SQLite wrappers)
7. **MIDI Controller Bridge**
8. **Export Engine** (directory dumper)

## Data Model & File Formats

### SQLite Schema (example)
```sql
CREATE TABLE patches (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE,
  loved BOOLEAN DEFAULT FALSE,
  category TEXT CHECK(category IN ('Bass','Lead','Pad','Pluck','Strings')),
  tags TEXT      -- JSON-encoded array of strings
);

CREATE TABLE sequences (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE,
  last_modified DATETIME
);
```

### `.mmseq` Parser Notes
- Top-level blocks: `Version`, `Settings`, `Steps`.
- Settings and Steps use `Key = Value;` syntax; Steps: `StepN = { Enabled = true; Note = 60; Velocity = 100; }`.
- Serialize must preserve ordering and comments (if any).

## UI/UX Flows & Wireframes
- **Library View**: Sidebar banks → patch grid/list → metadata editor panel.
- **Sequence View**: Grid + settings sidebar + playback controls + MIDI map mode.
- **Export Wizard**: Select target folder → preview directory tree → execute.

*(Wireframes to be sketched in Vibe and attached separately.)*

## Technology Stack & Tooling
- **Electron** (v25+)
- **UI**: React + TypeScript + Tailwind (or Styled Components)
- **State**: Redux or Zustand for metadata & sequence state
- **DB**: SQLite via `better-sqlite3`
- **Parser**: Custom Node.js module for `.mmseq`
- **MIDI**: `webmidi` (renderer) or `@julusian/midi` (main)
- **Build**: electron-builder for macOS (.dmg), Windows (.exe/.msi), Linux (.AppImage/.deb)
- **Testing**:
  - Unit: Jest (parser, serialize, DB)
  - Integration: Spectron or Playwright for end-to-end UI

## Testing Strategy
1. **Unit Tests**
   - Parser/serializer round-trip for `.mmseq`.
   - DB CRUD operations.
2. **Integration Tests**
   - Library import → metadata edit → export.
   - Sequence editing via simulated MIDI input.
3. **Manual QA**
   - Cross-platform packaging and install flows.
   - Performance benchmarks on ~1,000 patches.

## Deployment & Distribution
- **CI/CD** via GitHub Actions:
  - Lint, test, package on each push.
  - Auto-publish nightly builds to a staging channel.
- **Releases**:
  - Manual approval for stable tags.
  - Signed installers for macOS (notarization), Windows (code signing).

## Roadmap & Milestones
1. **MVP (4 weeks)**
  - .mmseq parser + basic grid editor
  - Patch import + metadata CRUD
  - SQLite integration
2. **Beta (8 weeks)**
  - MIDI controller support
  - Export engine
  - Cross-platform packaging
3. **v1.0 (12 weeks)**
  - UI polish, performance tuning
  - Automated tests, docs
  - User feedback integration
