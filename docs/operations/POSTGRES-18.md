# PostgreSQL 18 Docker volume layout

EVO v0.9.4 mounts the named PostgreSQL volume at `/var/lib/postgresql`, not `/var/lib/postgresql/data`.

The official PostgreSQL 18+ Docker image uses a major-version-specific cluster directory below `/var/lib/postgresql`. Mounting the legacy `/var/lib/postgresql/data` path causes the container to stop when it detects data at that obsolete mount point.

For a disposable local validation database created by an earlier EVO v0.9.x candidate, reset it once after upgrading:

```powershell
docker compose down -v
docker compose up -d --build
```

Do **not** use `down -v` on a database containing data that must be retained. Production PostgreSQL major-version upgrades require a proper backup/restore or `pg_upgrade` procedure.
