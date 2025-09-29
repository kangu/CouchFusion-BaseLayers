# Stringarray Storage Behavior

## Initial Prompt
The stringarray data type must be kept stringified in the database, so this is correct how it was before "[\"We help Bitcoiners launch1 their careers by enabling them to become the signal in a noisy job market.\",\"We're not recruiters. We're matchmakers, mentors, and community builders. We surface the best jobs, and coach Bitcoiners to stand out. We are also building Bitcoin's largest talent pool—so startups know exactly where to look, before they even post a job.\"]". Make sure to always save stringified and when reading for editing, to work with a parsed version. Make sure changes are saved correctly to the underlying stringified array.

## Implementation Summary
Ensured stringarray props remain JSON-stringified in registry consumers while editors parse for UI interaction and stringify again when saving.

## Documentation Overview
- NodeEditor now keeps an internal parsed array for editing but writes back stringified JSON via `onUpdateProp`, preserving database format.
- Workbench normalization preserves incoming stringified arrays (or stringifies plain arrays) so nodes always hold the serialized representation expected downstream.
- The user-facing builder UI still presents add/remove/edit controls for string arrays without exposing raw JSON to editors.

## Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue:466` – stringarray apply path emits JSON string payloads.
- `layers/content/app/components/builder/NodeEditor.vue:518` – CRUD helpers reuse parsed arrays while delegating persistence to the stringified updater.
- `layers/content/app/components/builder/Workbench.vue:82` – normalization retains serialized stringarray values for consistent storage.
