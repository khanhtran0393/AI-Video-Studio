# Observe-only Local Worker

A local Node.js 18+ process that polls the cloud service, leases one job, runs the repository's deterministic Debug Agent, and returns a read-only diagnosis.

It never invokes `AutonomousController.processBug()`, modifies source, builds, signs, releases, or accepts inbound network requests. The validated repository policy must remain `observe-only`.

Configure the values from `.env.example` in the process environment, then run `npm start` from this directory.
