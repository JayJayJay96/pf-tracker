# Dashboard Dark UI Design

## Goal

Refresh the signed-in dashboard so it feels like a polished dark personal finance app with subtle blue lining, while preserving all existing finance calculations and navigation.

## Scope

- Style the protected app shell and dashboard only.
- Keep existing dashboard data, labels, routes, and auth behavior unchanged.
- Use plain CSS and semantic React markup already available in the project.
- Avoid new dependencies.
- Keep the screen practical and scannable for repeated monthly use.

## Design

The dashboard will use a dark page background, a restrained top app bar, thin blue borders, and elevated panels with compact metric cards. The main focus is the remaining spendable amount, shown as the strongest card on the page, with supporting copy underneath.

The month picker sits in the header area so the user can quickly change period without hunting. Primary navigation becomes a horizontal set of compact links with active-dashboard styling implied by placement rather than route logic.

Metrics are grouped in a responsive grid. Labels remain plain and familiar: confirmed income, commitments, savings, investments, personal spending, cash outflow, friends owe, paid on behalf, upcoming commitments, pending requests, and days to next salary.

## Empty And Warning States

The no-snapshot message becomes a visible but calm panel that points the user to Monthly Plan. Unresolved shared bills remain a status message with a stronger border treatment, because they affect dashboard interpretation.

## Testing

Update dashboard rendering tests to assert the new semantic regions/classes while preserving existing content assertions. Run focused unit tests, typecheck, and build before pushing.
