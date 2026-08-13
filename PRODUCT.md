# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

SpeakSpace serves students, researchers, creators, and knowledge workers who capture spoken material and turn it into reusable knowledge.

## Product Purpose

SpeakSpace helps people record or import spoken material, transcribe it locally, work with it through local AI, organize it into workspaces and structured outputs, and retrieve it later. Success means a user can move from an unstructured conversation or recording to useful, searchable knowledge without sending sensitive material to a cloud service.

## Positioning

SpeakSpace combines recording, local transcription, local AI assistance, knowledge organization, and semantic retrieval in one privacy-first desktop workflow.

## Operating Context

The product is an Electron desktop application used during and after meetings, interviews, lectures, research sessions, and individual knowledge work. Its main surfaces are Studio, Agent, Workspace, Knowledge Templates, Model Management, and Settings.

## Capabilities and Constraints

- Preserve existing application behavior, data flows, routes, and local model/runtime integrations.
- The interface may reorganize navigation, hierarchy, layout, components, and motion when this improves usability.
- Local and offline-capable AI runtimes include speech-to-text, text-to-speech, embeddings, and language models.
- The interface supports Simplified Chinese and English, light and dark themes, adjustable text size, and onboarding guidance.
- Existing in-progress code changes in the working tree must be preserved.

## Brand Commitments

- Preserve the product name `SpeakSpace`.
- Preserve the recognizable blue `SS` application mark.
- The incumbent purple-gradient interface is not a binding brand element and may be replaced.
- The product should communicate privacy, focus, capability, and trust without obscuring familiar desktop affordances.
- For this redesign, use the code-led execution path so the chosen visual world governs every major surface without sacrificing existing workflows to a single fixed mockup.

## Evidence on Hand

- Existing product implementation under `src/renderer` and `src/main`.
- Existing application icons under `assets/`.
- Existing English and Simplified Chinese locale files under `src/i18n/locales/`.
- No customer claims, testimonials, benchmarks, pricing, or other commercial proof are available and none should be fabricated.

## Product Principles

1. Keep private knowledge local by default.
2. Make the path from speech to useful knowledge direct and understandable.
3. Keep AI capabilities inspectable and under the user's control.
4. Prefer calm operational clarity over decorative complexity.
5. Preserve user work and application behavior while improving how the system communicates state and priority.

## Accessibility & Inclusion

Maintain keyboard access, visible focus, sufficient contrast, reduced-motion support, responsive layouts, and readable text across the supported light and dark themes and text-size settings.
