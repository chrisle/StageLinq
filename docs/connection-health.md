# Connection Health

Monitor StageLinq connection health and handle automatic reconnection.

## Usage

```ts
import { ConnectionHealth } from 'stagelinq';

const health = new ConnectionHealth({
  heartbeatInterval: 5000,    // Check every 5 seconds
  staleTimeout: 15000,        // Consider stale after 15 seconds
  maxReconnectAttempts: 3,    // Try 3 times to reconnect
  reconnectDelay: 2000,       // Wait 2 seconds between attempts
});

// Set up reconnection callback
health.setReconnectCallback(async () => {
  try {
    await stagelinq.reconnect();
    return true;
  } catch {
    return false;
  }
});

// Monitor health events
health.on('stale', () => {
  console.log('Connection is stale, reconnecting...');
});

health.on('reconnecting', (attempt) => {
  console.log(`Reconnect attempt ${attempt}...`);
});

health.on('reconnected', () => {
  console.log('Successfully reconnected!');
});

health.on('reconnectFailed', () => {
  console.log('All reconnect attempts failed');
});

// Start monitoring
health.start();

// Record activity when data is received
stagelinq.on('stateMessage', () => {
  health.recordActivity();
});
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `heartbeatInterval` | 5000 | Milliseconds between health checks |
| `staleTimeout` | 15000 | Milliseconds before connection is considered stale |
| `maxReconnectAttempts` | 3 | Maximum reconnection attempts |
| `reconnectDelay` | 2000 | Milliseconds between reconnection attempts |

## Events

```ts
health.on('healthy', () => {});
health.on('unhealthy', (status: ConnectionStatus) => {});
health.on('stale', () => {});
health.on('reconnecting', (attempt: number) => {});
health.on('reconnected', () => {});
health.on('reconnectFailed', () => {});
```

## ConnectionStatus

```ts
interface ConnectionStatus {
  isHealthy: boolean;
  lastActivity: number;      // Timestamp
  missedHeartbeats: number;
  reconnectAttempt: number;
}
```

## Methods

```ts
// Start monitoring
health.start();

// Stop monitoring
health.stop();

// Record activity (call when data is received)
health.recordActivity();

// Get current status
const status = health.getStatus();

// Check if healthy
if (health.isHealthy) { ... }

// Force reconnection
await health.forceReconnect();

// Reset state
health.reset();
```

## Integration Example

```ts
import { StageLinq, ConnectionHealth } from 'stagelinq';

const stagelinq = new StageLinq();
const health = new ConnectionHealth();

health.setReconnectCallback(async () => {
  await stagelinq.disconnect();
  await stagelinq.connect();
  return true;
});

// Track activity
stagelinq.devices.on('stateMessage', () => health.recordActivity());
stagelinq.devices.on('beatMessage', () => health.recordActivity());

// Handle reconnection events
health.on('reconnected', () => {
  console.log('Connection restored');
});

health.on('reconnectFailed', () => {
  console.error('Unable to reconnect');
  process.exit(1);
});

await stagelinq.connect();
health.start();
```
