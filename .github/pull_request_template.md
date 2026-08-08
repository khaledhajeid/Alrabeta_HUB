## Summary

<!-- What changed, and why — the "why" matters more than the "what". -->

## Verification

<!-- What you actually ran/checked, not just what should theoretically work.
     Delete lines that don't apply, don't leave placeholders unchecked. -->

- [ ] `tsc --noEmit`, `eslint`, `next build` all pass
- [ ] UI change: Playwright pass at 375/768/1280px, both themes, console-checked
- [ ] Touches grading/sandbox: re-verified against `infra/sandbox/fixtures/*`
- [ ] Touches schema: migration applied via `drizzle-kit push`, verified against real Postgres

## Test plan

<!-- Bulleted checklist of what a reviewer (or future you) should confirm. -->
