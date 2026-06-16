# Repository Reset Design

## Goal

Allow an authenticated user to reset the currently onboarded repository so they can rerun the full onboarding flow from a clean state.

## Behavior

- Show a confirmation before reset.
- Reset only the selected repository owned by the current user.
- Delete persisted onboarding scan results for that repository.
- Delete the repository clone directory from disk when it exists.
- Clear clone metadata on the repository row so it is no longer considered onboarded or cloned.
- Clear browser-side active repository and dashboard cache for that repo.
- Redirect the user to `/onboarding` after a successful reset.

## API

Add `POST /api/repos/:repoId/reset`.

The route requires auth, verifies ownership through `ReposRepository.getForUser`, deletes derived scan data through `OnboardingRepository`, deletes the clone path using guarded filesystem removal, then marks the repo as pending with null clone fields.

## UI

Add a `Reset` action on the dashboard top bar when a repository is active. The action opens the existing confirmation modal. While the request is in flight, disable the button and show a resetting label. On failure, keep the user on the dashboard and show a toast.

## Testing

- Backend unit/route coverage verifies reset deletes onboarding data, clears repo clone metadata, and removes the clone directory.
- Frontend typecheck verifies API wiring and UI props.
