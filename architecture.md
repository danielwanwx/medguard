# MedGuard — Architecture

```
                       ┌──────────────────────────────────────────────────────┐
  User (browser,       │  React UI  (medguard/ui, Vite)                        │
  mobile-first)  ───▶  │  health profile · scan/add · agent-workflow trace ·   │
                       │  finding (recall/interactions/dosage) · cabinet ·     │
                       │  one-tap doctor history                               │
                       └───────────────┬──────────────────────────────────────┘
                                       │  POST /api/medcheck {scan, profile}
                                       ▼
                       ┌──────────────────────────────────────────────────────┐
                       │  server.py (HTTP)                                      │
                       └───────────────┬──────────────────────────────────────┘
                                       ▼
                       ┌──────────────────────────────────────────────────────┐
                       │  agent.py — Strands Agents SDK agent                   │
                       │  (Bedrock Nova Pro, us.amazon.nova-pro-v1:0)           │
                       │  autonomously calls real tools; grounds every claim    │
                       │  in tool output; cites sources; defers to pharmacist   │
                       └───┬──────────┬───────────────┬───────────────┬────────┘
                           ▼          ▼               ▼               ▼
                    identify_    check_recall   check_          check_dosage
                    supplement                 interactions
                       │            │               │               │
                       ▼            ▼               ▼               ▼
                  NIH DSLD     openFDA drug   curated rules    NIH ODS Upper
                  (live)       enforcement    (source-cited)   Intake Levels
                               (live recall)
```

**Principle:** the model advises and orchestrates; the TOOLS return authoritative live
official data (identity + recalls are never invented); the human/pharmacist decides.
AgentCore Runtime deployment is an optional Technical-strengthening add-on.
