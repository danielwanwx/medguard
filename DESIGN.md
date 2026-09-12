# MedGuard product design

## Product promise

**Confirm the label. Understand the evidence. Bring a dated record to a pharmacist.**

The primary user is someone checking a supplement alongside medicines they take, or preparing a cabinet list for a caregiver conversation. This prototype reviews individual supplement labels against entered medicines/conditions. It does not claim continuous protection or replace clinical judgment.

## Research into decisions

[COMPETITORS.md](COMPETITORS.md) contains the dated primary-source comparison. Medisafe/MyTherapy already offer reminders, records and sharing; ChatGPT Health supports personal context. We avoid a false “chatbots only know old training data” pitch. MedGuard emphasizes explicit label selection, inspectable evidence and a bounded review note.

The [Duolingo core-tab redesign](https://blog.duolingo.com/core-tabs-redesign/) informed simplified navigation, spacing and type hierarchy. [Finch onboarding](https://help.finchcare.com/hc/en-us/articles/42149821015693-New-User-Guide) informed approachable steps; [Headspace](https://www.headspace.com/) informed calm, benefit-led language. We borrow principles, not mascots or clinical claims.

## Screens and decisions

| Screen | Main decision | Boundary |
|---|---|---|
| Welcome | Set up or explicitly try synthetic data | No silent health fixture |
| Profile | Save optional medicines/conditions | Explain storage and transmission |
| Find label | Enter product/brand text | No implied camera or pill identification |
| Candidates | Compare a NIH label with the bottle | No automatic selection or save |
| Waiting | Await real results | No invented completed tools |
| Review | Inspect evidence, optionally save | No CLEAR/safe verdict; live/curated distinguished |
| Cabinet | Revisit or recheck dated records | Profile changes make previous reviews stale |
| Pharmacist note | Review, download or print | Unknown dose/frequency/lot; not complete medical history |

Check, Cabinet and Profile use bottom navigation. An illustrated welcome introduces the app; evidence detail uses progressive disclosure. The disclaimer remains in the application.

## Visual system

Cream, forest, sage and peach create a friendly consumer surface. Nunito Sans supplies the rounded type scale, Lucide supplies icons, and the bottle artwork is original SVG. Shared buttons, fields, badges and source links keep state treatment consistent. Radix Dialog/Accordion supply keyboard and disclosure primitives. Tokens live in `ui/src/medguard.css`; the inherited warehouse stylesheet is replaced.

Touch controls target at least 44 px, with visible keyboard focus and pressed feedback. Motion respects reduced-motion preferences. Color indicates review state or source completion, never medical safety. No “protected” streak or reward for taking medicine is used.

## Evidence presentation

- Catalog selection means user confirmation, not physical or clinical verification.
- FDA records retain product, firm, lot/code, recall number, status and dates. Potential matches require human comparison; terminated records remain labeled terminated.
- Interaction priorities are app review labels with direct NIH/NCCIH citations and limited curated coverage.
- Adult dosage references disclose formulation scope and unknown intake. Missing rows never justify reassurance.
- The trace displays actual request-local tool calls and success/error/blocked outcomes.
- Incomplete reviews cannot be saved as completed checks. Retry uses the intended query and current profile.

## Data lifecycle

Versioned browser storage retains profile and confirmed reviews, catalog ID, original query, check date and profile snapshot. Profile edits invalidate outdated findings. Corrupt/unavailable storage is disclosed. Users remove entries or clear local data. There is no cloud backup or background watcher.

The pharmacist note includes entered medicines/conditions, saved labels, dates, prompts, unknown dose/frequency/lot, citations and scope. It is generated locally, not sent as a message. Synthetic profile use remains labeled in exports.

## Acceptance bar

Real Bedrock/NIH/FDA calls; 1440 px desktop and 390 px mobile screenshots; explicit confirmation; reload persistence; stale-profile behavior; faithful trace/source data; dialog Escape/focus; actual note download. Synthetic failure tests are labeled separately. See [current acceptance](ACCEPTANCE.md) and [baseline evaluation](EVALUATION.md).

## Roadmap, not shipped

Camera OCR, expiry capture, whole-cabinet duplicate/interaction reasoning, scheduled recall checks with opt-in notifications, clinically reviewed broader rules, authenticated storage, caregiver sharing and AgentCore deployment. Each needs evidence and boundaries before becoming a shipped claim.
