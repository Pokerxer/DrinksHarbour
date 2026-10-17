---
name: AWS migration assessment
description: Portability findings and open decisions from the October 2026 Vercel-to-AWS discussion.
type: project
---

The user asked about feasibility only; no AWS migration is authorized or underway.
Apps are standard Next.js 16 (platform) and Next.js 15 (admin), plus an Express API.
Main effort is infrastructure and operational setup. Account for admin build memory,
wildcard tenant routing/cache isolation, Socket.IO scaling and duplicate cron jobs.
Keep existing external data/payment/image services initially. Current live infrastructure
and usage were not inspected. ECS Fargate is a candidate; Amplify version/feature support
needs checking for the Next.js 16 platform.

See [assessment and sources](../superpowers/specs/RESUME-aws-migration-assessment.md).
