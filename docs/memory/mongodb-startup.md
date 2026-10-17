---
title: MongoDB startup discovery and bounded recovery
date: 2026-10-13
status: verified locally
---

# MongoDB startup discovery and recovery

Local startup failed with MongooseServerSelectionError after 10 seconds and
ReplicaSetNoPrimary. The process exited before listening, leaving nodemon
waiting for changes. Earlier accounting reads reported closed monitoring sockets.
The exact cause of the network interruption was not established.

A fresh read-only connection using the configured DNS override and a 30-second
budget succeeded in 4.6 seconds. The existing backend at 127.0.0.1:5001 subsequently
reported status OK and MongoDB Connected. Its uptime was already about 19 minutes,
so this health check does not prove it loaded the new startup code or restarted.
No existing server processes were terminated or restarted by this session.

`server/config/db.js` now defaults to 30 seconds of server selection for
long-running processes and retains 10 seconds on Vercel. The explicit
MONGO_SERVER_SELECTION_TIMEOUT_MS override applies to either environment.
Reference: [MongoDB driver options](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/).

`server/utils/db-startup.js` retries only the startup connection handshake up to
three times, pausing one second between transient failures. It recognizes the
Mongoose selection wrapper and existing classified driver connectivity errors.
Configuration/authentication errors fail immediately. `server.js` invokes it
before reconciliation, cron registration and listening; those operations are
not replayed. A sustained outage still exits after the bounded attempt budget.
With defaults the selection budget is up to roughly 92 seconds plus DNS time.
Per-request database connection handling and payment writes are unchanged.

Tests: 26 focused connection/startup checks pass. Full server suite: 3,747 pass,
zero failures, six opt-in skips (3,753 total). Syntax and touched-file whitespace
checks pass. Manual diff review found no additional issue; CodeRabbit unavailable.
Changes remain local and uncommitted. No Atlas/network configuration or database
records were changed. Restart the local watcher to load startup code if it has
not already reloaded. Do not start a second backend on occupied port 5001.
