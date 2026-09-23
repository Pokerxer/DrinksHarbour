# MongoDB Atlas DNS ESERVFAIL recovery

Date: 2026-09-21

## Symptom

Backend startup failed before opening port 5001 with `querySrv ESERVFAIL` for the Atlas `_mongodb._tcp` SRV record. Nodemon stayed alive but its Node child exited.

## Diagnosis

The configured `MONGODB_URI` parsed correctly as a `mongodb+srv` URI with the expected database and Atlas hostname. The Atlas SRV and TXT records resolved successfully through the system resolver, Cloudflare, and Google when retested. A direct connection through `config/db.js` then succeeded. This ruled out a malformed URI, invalid credentials, a missing Atlas DNS record, and application query logic.

The failure was a transient DNS resolver outage. Two nodemon watchers were also present for the server directory; the older orphaned watcher was stopped to prevent a port collision after recovery.

## Recovery

Start one backend watcher from `server/` with `npm run dev`. On recovery it must log `New database connection established`, report MongoDB connected, and listen on port 5001. Verify `GET http://127.0.0.1:5001/health` returns `status: OK` and `mongodb: Connected`.

If `ESERVFAIL` recurs, compare the system SRV lookup with a public resolver before changing the URI. Restart nodemon after DNS resolves because a crashed child may remain waiting for a file change.
