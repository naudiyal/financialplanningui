# BMAD Squad For New-User Ease Of Use

## Goal

Figure out how to make the application easy for a first-time user to understand, set up, and successfully use without outside help.

This squad is intentionally focused on the current application, not a greenfield redesign.

## Recommended Squad

### 1. Saga — Analyst

**Role:** Map the first-time user journey, friction points, and decision load.

**Primary questions:**
- What does a new user have to understand before the app becomes useful?
- Which setup steps are mandatory versus advanced?
- Where will a new user most likely get stuck or abandon?
- Which terms, labels, and calculations are too domain-heavy for first use?

**Outputs:**
- First-time user problem framing
- Top 10 onboarding friction points
- Prioritized opportunity list
- Success metrics for first-session completion

### 2. Freya — UX Designer

**Role:** Design the onboarding experience and reduce cognitive load in the UI.

**Primary questions:**
- What should the user see on the empty dashboard?
- What is the smallest guided setup that gets the user to a useful first result?
- Which sections need progressive disclosure instead of showing the full tracker immediately?
- Where do we need helper text, defaults, examples, or inline explanations?

**Outputs:**
- First-time user flow
- Empty-state design
- Guided setup flow for banks, expenses, and credit cards
- UI recommendations for plain-language labels and hints

### 3. Paige — Tech Writer

**Role:** Make the product understandable in-product.

**Primary questions:**
- Which labels need rewriting in plain language?
- What short helper copy should appear during setup?
- What should the app say when a user cannot proceed?
- What quick-start content should exist outside the product?

**Outputs:**
- Microcopy rewrite list
- Tooltip and helper-text recommendations
- Quick-start guide outline
- Onboarding checklist content

### 4. Mimir — Builder

**Role:** Convert the analysis and design into shippable increments.

**Primary questions:**
- What is the smallest implementation slice that materially improves first-use success?
- Which changes can be added to the current `FinancialPlanningUI` without a broad refactor?
- Where can defaults, examples, sample data, and guided sequencing be introduced safely?
- What can be validated quickly with the existing build flow?

**Outputs:**
- Implementation plan
- Delivery slices by priority
- Risk list for rollout
- Frontend changes and validation notes

## Why This Squad Fits This Repo

This workspace already has an established BMAD WDS pattern using Saga, Freya, and Mimir in `FinancialPlanningMobileV2`.

The current application also already has several first-use gates and setup demands that make onboarding a real UX problem:

- Terms acceptance before app use
- First-time encrypted setup
- PIN creation
- Currency selection
- Cycle type selection
- Financial structure setup across banks, credit cards, and expenses

Those decisions are documented in the current project notes and make this an onboarding and clarity problem more than a pure engineering problem.

## Scope The Squad Should Study

The squad should review the first-time user path from sign-in to first useful dashboard state.

### Journey segments

1. Authentication and terms acceptance
2. First-time encrypted setup
3. Empty dashboard state
4. Adding the first bank account
5. Adding debit expenses
6. Adding credit cards
7. Understanding how to use the tracker during the first cycle
8. Understanding why actions like Close Cycle are or are not available

### Specific friction to investigate

- Too many financial concepts introduced at once
- Domain-specific labels that assume prior knowledge
- Lack of a guided setup order
- Insufficient examples for first data entry
- Empty states that do not tell the user what to do next
- Validation messages that explain rules but not intent
- Advanced sections appearing before the user has baseline data

## Questions The Squad Must Answer

1. What is the fastest path for a new user to reach a trustworthy first dashboard?
2. Which fields can be deferred until after the first successful setup?
3. Which current labels need plain-language replacements or helper text?
4. Should the app offer a sample plan, starter template, or guided wizard?
5. What should be visible on day one versus hidden behind expansion or later steps?
6. How should the app teach concepts like statement cycle, paid status, and close-cycle requirements?

## Recommended Working Sequence

1. Saga audits the current first-time flow and produces a ranked friction list.
2. Freya turns the highest-friction items into a simplified onboarding flow and empty-state design.
3. Paige rewrites the critical onboarding copy, labels, and helper text.
4. Mimir turns the approved flow into small implementation slices for `FinancialPlanningUI`.

## Suggested First Deliverables

The squad should target these deliverables first:

1. A first-time user journey map for the current web app
2. A plain-language label audit for the main tracker sections
3. An empty-state and guided-setup proposal for the dashboard
4. A proposal for sample data or a starter plan
5. A prioritized implementation backlog for the top 3 onboarding improvements

## Acceptance Criteria For The Squad's Work

The squad has done its job when it can show:

- a clear first-session path from sign-in to completed initial setup
- a concrete list of confusing labels and their proposed replacements
- a minimal guided setup flow that reduces first-use decision load
- a prioritized implementation plan that fits the current UI architecture
- measurable success criteria for first-time user completion

## Strong Initial Hypotheses

If the squad needs a starting point, these are the best initial bets:

1. Add a guided empty-state dashboard that clearly tells users to start with bank accounts.
2. Break first-time setup into ordered steps instead of exposing the whole tracker immediately.
3. Add inline examples and helper copy for the hardest financial terms.
4. Add a sample plan or starter template so users can understand the system before entering everything manually.
5. Add clearer reason text and next-step guidance whenever an action is unavailable.

## Relevant Existing References

- Current onboarding and gating notes: `FinancialPlanningAgent.md`
- Existing BMAD squad pattern: `FinancialPlanningMobileV2/docs/PROJECT_JOURNAL.md`
- Existing first-time setup UX scenario reference: `FinancialPlanningMobileV2/design-artifacts/C-UX-Scenarios/00-ux-scenarios.md`