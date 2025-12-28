# FileTransfer Service

The FileTransfer service enables downloading files from DJ hardware, including Engine databases and album artwork.

## Usage

### Automatic Database Download

```ts
import { StageLinq } from 'stagelinq';

const stagelinq = new StageLinq({
  downloadDbSources: true,  // Auto-download databases
});

stagelinq.devices.on('dbDownloading', (sourceId, dbPath) => {
  console.log(`Downloading database for ${sourceId}...`);
});

stagelinq.devices.on('dbProgress', (sourceId, total, downloaded, percent) => {
  console.log(`${sourceId}: ${percent.toFixed(1)}%`);
});

stagelinq.devices.on('dbDownloaded', (sourceId, dbPath) => {
  console.log(`Database saved to: ${dbPath}`);
});

await stagelinq.connect();
```

### Manual File Download

```ts
stagelinq.devices.on('ready', async (info) => {
  const device = stagelinq.devices.getDevice(info);
  const fileTransfer = await device.connectToService(FileTransfer);

  // Download a specific file
  const data = await fileTransfer.getFile('/Engine Library/m.db');

  // Save to disk
  fs.writeFileSync('m.db', data);
});
```

## Events

### Database Events

```ts
// New source discovered (USB, SD card, internal)
stagelinq.devices.on('newSource', (source: SourceInfo) => {});

// Database download started
stagelinq.devices.on('dbDownloading', (sourceId: string, dbPath: string) => {});

// Download progress
stagelinq.devices.on('dbProgress', (
  sourceId: string,
  total: number,
  downloaded: number,
  percent: number
) => {});

// Download complete
stagelinq.devices.on('dbDownloaded', (sourceId: string, dbPath: string) => {});
```

### File Transfer Events

```ts
// Raw file message
stagelinq.devices.on('fileMessage', (data: FileTransferData) => {});

// Transfer progress
stagelinq.devices.on('fileTransferProgress', (
  source: string,
  fileName: string,
  txid: number,
  progress: Progress
) => {});

// Transfer complete
stagelinq.devices.on('fileTransferComplete', (
  source: string,
  fileName: string,
  txid: number
) => {});
```

## Database Structure

Downloaded databases are SQLite files containing:

- **Track** - Track metadata (title, artist, BPM, key, etc.)
- **AlbumArt** - Album artwork blobs
- **Playlist** - Playlists and their tracks
- **Crate** - Crates and their tracks
- **History** - Play history

### Querying the Database

```ts
import Database from 'better-sqlite3';

const db = new Database('m.db');

// Get all tracks
const tracks = db.prepare('SELECT * FROM Track').all();

// Search tracks
const results = db.prepare(`
  SELECT * FROM Track
  WHERE title LIKE ? OR artist LIKE ?
`).all('%search%', '%search%');
```

## File Paths

Files are accessed via network paths:

```
/Engine Library/m.db           - Main database
/Engine Library/p.db           - Performance data
/Engine Library/Music/...      - Audio files
```

## Source Names

Common source identifiers:

| Source | Description |
|--------|-------------|
| `(Internal)` | Internal storage |
| `USB 1`, `USB 2` | USB drives |
| `SD Card` | SD card slot |
