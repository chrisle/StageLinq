# StageLinQ Wireshark Dissector

A Lua dissector for analyzing StageLinQ protocol traffic in Wireshark.

Ported from PyStageLinQ by Jaxc
Original: https://github.com/Jaxc/PyStageLinQ

## Installation

### macOS
```bash
mkdir -p ~/.local/lib/wireshark/plugins
cp stagelinq.lua ~/.local/lib/wireshark/plugins/
```

### Linux
```bash
mkdir -p ~/.local/lib/wireshark/plugins
cp stagelinq.lua ~/.local/lib/wireshark/plugins/
```

### Windows
Copy `stagelinq.lua` to:
```
%APPDATA%\Wireshark\plugins\
```

## Usage

After installation, restart Wireshark. The dissector automatically decodes:

- **UDP port 51337**: Discovery announcements
- **Dynamic TCP ports**: Service communications (StateMap, FileTransfer, BeatInfo)

### Display Filters

```
# All StageLinQ traffic
stagelinq

# Discovery only
stagelinq_discovery

# StateMap service
stagelinq_statemap

# FileTransfer service
stagelinq_filetransfer

# BeatInfo service
stagelinq_beatinfo

# Filter by action
stagelinq.discovery.action contains "HOWDY"

# Filter by software
stagelinq.discovery.software_name contains "SC6000"

# Filter by state name
stagelinq.statemap.state_name contains "CurrentBPM"
```

## Protocol Overview

### Discovery (UDP 51337)

Devices announce themselves and discover others on the network.

| Field | Size | Description |
|-------|------|-------------|
| Magic | 4 | `"airD"` |
| Token | 16 | Device identifier |
| Source | var | Device source name (UTF-16) |
| Action | var | `DISCOVERER_HOWDY_` or `DISCOVERER_EXIT_` |
| Software Name | var | e.g., `"SC6000"` |
| Software Version | var | e.g., `"3.3.0"` |
| Port | 2 | TCP service port |

### StateMap Service

Real-time state updates from devices.

| Message Type | Value | Description |
|--------------|-------|-------------|
| JSON State | 0x00000000 | State name + JSON value |
| Interval Sub | 0x000007d2 | Subscribe with interval |

Common state paths:
- `/Engine/Deck1/Play` - Play/pause state
- `/Engine/Deck1/Track/SongName` - Track title
- `/Engine/Deck1/CurrentBPM` - Current BPM
- `/Mixer/CH1faderPosition` - Channel fader position

### FileTransfer Service

File downloads from devices (databases, audio files).

| Message ID | Name | Description |
|------------|------|-------------|
| 0x0 | TimeCode | Time synchronization |
| 0x1 | FileStat | File metadata |
| 0x2 | EndOfMessage | Transfer complete |
| 0x3 | SourceLocations | Available sources |
| 0x4 | FileTransferId | Start transfer |
| 0x5 | FileTransferChunk | File data chunk |

### BeatInfo Service

Real-time beat and timing information.

| Field | Size | Description |
|-------|------|-------------|
| ID | 4 | Message ID |
| Clock | 8 | Timestamp |
| Deck Count | 4 | Number of decks |
| Beat (per deck) | 8 | Current beat position |
| Total Beats (per deck) | 8 | Total beats in track |
| BPM (per deck) | 8 | Current BPM |
| Samples (per deck) | 8 | Sample position (optional) |

## Known Device Tokens

| Token | Device |
|-------|--------|
| `52fdfcc7...` | SoundSwitch |
| `828beb02...` | SC6000 (1) |
| `26d23867...` | SC6000 (2) |
| `88fa2099...` | Resolume |

## Troubleshooting

### Dissector not loading

1. Check Wireshark version (requires 3.0+)
2. Verify file location:
   - Help → About Wireshark → Folders → Personal Lua Plugins
3. Check Lua console for errors:
   - Tools → Lua → Evaluate

### Missing packets

- Ensure you're capturing on the correct interface
- Check that promiscuous mode is enabled
- For discovery, capture on UDP port 51337
- For services, capture all TCP traffic (ports are dynamic)

## References

- [chrisle/StageLinq](https://github.com/chrisle/StageLinq) - TypeScript implementation
- [icedream/go-stagelinq](https://github.com/icedream/go-stagelinq) - Go implementation
- [Jaxc/PyStageLinQ](https://github.com/Jaxc/PyStageLinQ) - Python implementation
