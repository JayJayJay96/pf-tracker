# Personal Finance PWA — Project Description

**Document purpose:**  
This file is the source of truth for the project. It should be reviewed at the start of every working session and updated whenever product rules, requirements, calculations, or scope change.

**Current status:** Product planning  
**Primary user:** Personal use by the owner  
**Potential future users:** Friends may later receive shared access or bill-viewing links  
**Primary currency:** RM (Malaysian Ringgit)  
**Platform:** Progressive Web App (PWA)

---

## 1. Project Overview

The project is a personal finance Progressive Web App designed to answer one main question:

> How much money do I actually have available to spend after income, commitments, savings, investments, and personal spending are taken into account?

The application will also solve a second major problem:

> When the user pays for a shared bill, how can the app separate the user's own portion from amounts owed by friends, calculate taxes and discounts correctly, and track whether the friends have repaid the amount?

The application is not intended to be a full accounting system or an overly detailed expense-tracking platform. Its priority is to make financial tracking simple enough that the user will consistently use it.

---

## 2. Core Problems to Solve

### 2.1 Unclear spendable amount

A bank account balance does not represent how much money is truly safe to spend.

The user needs a clearer calculation that considers:

- Fixed salary
- Variable KPI income
- Monthly commitments
- Savings allocations
- Investment allocations
- Personal spending already made
- Upcoming commitments

The app should show a clear remaining spendable amount for the selected financial period.

### 2.2 Daily expense tracking feels troublesome

Traditional expense-tracking apps often require too many details.

The user may avoid recording expenses when:

- Too many fields are required
- A bill needs to be split first
- The exact personal portion is not yet known
- The user is busy and wants to record it later
- A shared bill contains discounts, taxes, or service charges

The app should allow fast recording and support unresolved transactions that can be completed later.

### 2.3 Shared bills are difficult to calculate

When the user pays a shared bill, the full amount leaves the user's cash or TNG balance, but not all of it is the user's personal spending.

The app must distinguish between:

- Total money paid
- User's actual personal portion
- Amount paid on behalf of friends
- Amount friends still owe
- Amount already repaid

### 2.4 Friends' repayments are easy to forget

The user sometimes accumulates several shared expenses before requesting repayment.

The app should:

- Track each friend's outstanding amount
- Group multiple expenses into one payment request
- Generate one lump-sum total
- Record whether the payment request is pending or paid
- Preserve the exact list of bills included in each request

---

## 3. Product Vision

The application should function as a personal financial control centre that is:

- Fast to use
- Easy to understand
- Accurate for shared bills
- Focused on true personal spending
- Useful for both current and historical financial review
- Installable and usable like a mobile application
- Flexible enough to evolve later

The app should not feel like accounting software.

---

## 4. Product Principles

### 4.1 Separate cash movement from personal spending

If the user pays RM300 for a shared dinner:

- User's portion: RM80
- Friend A's portion: RM100
- Friend B's portion: RM120

The system records:

- Total cash paid: RM300
- User's personal spending: RM80
- Friends owe the user: RM220

When friends repay the RM220:

- The repayment is not treated as income
- The original personal spending remains RM80
- The friends' outstanding balances are reduced

### 4.2 Make recording possible before calculation

The user should be allowed to save:

> RM240 dinner, shared, calculate later

The transaction is stored as unresolved.

The user can later:

- Add bill items
- Assign people
- Add discounts
- Add tax
- Add service charges
- Confirm the final breakdown

### 4.3 Avoid unnecessary complexity

The MVP should not initially include:

- AI natural-language input
- Automatic receipt interpretation
- Bank account integration
- Automatic WhatsApp messaging
- Multiple currencies
- Complex credit card reconciliation
- Partial friend repayments
- Full collaborative friend accounts

### 4.4 Historical records must remain accurate

Changes to current salary, commitments, or savings settings must not rewrite previous months.

Past transactions should keep the values that were recorded for their original dates.

---

## 5. Target User and Usage

### 5.1 Initial user

The first version is for one personal user.

### 5.2 Possible future sharing

The app may later support:

- Read-only bill links for friends
- Shared bill breakdown pages
- Friend confirmation of assigned items
- Friend accounts
- Shared group expenses

These are not part of the initial MVP.

### 5.3 Typical payment methods

The user mainly pays using:

- Touch 'n Go eWallet
- Cash

These are payment-method labels only.

The MVP does not need to maintain an exact live TNG balance or physical cash balance.

---

## 6. Main Financial Calculation

The primary dashboard calculation is:

```text
Confirmed income
− Monthly commitments
− Savings allocations
− Investment allocations
− Personal spending
= Remaining spendable amount
```

### 6.1 Confirmed income

Confirmed income includes:

- Fixed salary received
- KPI income received
- Other confirmed income

Unconfirmed estimated income should not increase the safe-to-spend figure.

### 6.2 Commitments

Commitments are expected or mandatory expenses such as:

- Home loan
- Car instalment
- Insurance
- Utilities
- Phone bill
- Family allowance
- Subscriptions
- Other recurring obligations

### 6.3 Savings and investments

Savings and investments should be treated as planned commitments.

This prevents the app from showing money as spendable when the user has already decided to reserve it.

### 6.4 Personal spending

Personal spending includes only the portion that belongs to the user.

Amounts paid on behalf of friends do not count as personal spending.

### 6.5 Total money paid

The app should separately show total cash outflow.

Example:

```text
Shared dinner paid: RM500
User's portion: RM100
Friends' portions: RM400
```

Dashboard impact:

- Total money paid increases by RM500
- Personal spending increases by RM100
- Friends owe the user RM400

---

## 7. Dashboard Requirements

The home dashboard should show at minimum:

- Remaining spendable amount
- Confirmed income for the current period
- Commitments
- Savings and investment allocations
- Personal spending
- Total amount paid out
- Amount paid on behalf of friends
- Total amount friends currently owe
- Upcoming commitments
- Number of unresolved transactions
- Number of pending payment requests
- Days until the next salary or financial period

The dashboard should allow changing the viewed month or period.

---

## 8. Financial Period

The application must support historical periods.

### Default period: Calendar month

The default financial and budgeting period is:

```text
1st day of the month to the final day of the same month
```

Example:

```text
1 July 2026 to 31 July 2026
```

This period is used for:

- Income reporting
- Commitment tracking
- Savings and investment allocations
- Personal spending
- Remaining spendable calculations
- Historical month comparison
- Monthly dashboard summaries

The salary date may still be stored separately for reminders and cash-flow context, but it does not change the reporting period.

A configurable salary-cycle mode may be considered in a future version, but it is not part of the MVP.

---

## 9. Income Management

### 9.1 Fixed salary

The user has a fixed base salary.

Required fields:

- Name
- Amount
- Expected date
- Recurrence
- Active status
- Start date
- Optional end date
- Confirmed or pending status

The recurring salary entry may be generated automatically for each period.

### 9.2 KPI income

KPI income is variable.

Required behaviour:

- Manually add the amount when received
- Do not include estimated KPI income in safe-to-spend calculations
- Show KPI income separately in reports
- Allow backdated KPI entries

### 9.3 Other income

The app should support other income entries such as:

- Refunds
- Reimbursements
- Bonuses
- Gifts
- Side income

A repayment from a friend must not be treated as income.

---

## 10. Commitments, Savings, and Investments

### 10.1 Recurring commitments

Each commitment should include:

- Name
- Amount
- Due date
- Frequency
- Fixed or estimated amount
- Category
- Active status
- Start date
- Optional end date
- Paid or pending status
- Optional notes

### 10.2 Variable commitments

For bills with changing amounts:

- Create an estimated amount
- Replace it with the actual amount when known
- Preserve the original month's actual value
- Do not update historical months when the recurring template changes

### 10.3 Savings and investments

Savings and investments should be separate categories but use similar recurring logic.

Examples:

- Emergency fund
- Unit trust
- Stocks
- Retirement savings
- Fixed deposit
- Other investment allocation

---

## 11. Expense Entry

### 11.1 Quick personal expense

Minimum fields:

- Amount
- Description
- Date
- Category
- Payment method
- Personal or shared

Payment method options for MVP:

- Touch 'n Go
- Cash

Optional fields:

- Notes
- Merchant
- Tags
- Attachment

### 11.2 Shared expense

A shared transaction should support:

- Total bill amount
- Bill date
- Description
- Merchant
- Payment method
- Bill items
- People
- Discounts
- Service charge
- Tax
- Rounding adjustment
- User's personal portion
- Each friend's portion
- Settlement status

### 11.3 Unresolved transaction

The user can record a shared expense before calculating it.

Required fields:

- Total amount
- Description
- Date
- Payment method
- Shared status

The transaction is marked:

- Unresolved

It should not be considered fully final until the bill is allocated.

Possible treatment before resolution:

- Show full cash outflow
- Do not finalise personal spending
- Show the amount in an unresolved section
- Warn that the dashboard may be incomplete until the bill is resolved

---

## 12. Shared Bill Item Assignment

### 12.1 Bill items

Each shared bill can contain multiple items.

Example:

```text
Nasi lemak       RM18
Chicken chop     RM28
Pizza            RM48
Drinks           RM20
Dessert          RM16
```

Each item may be assigned to:

- The user
- One friend
- Multiple selected people
- Everyone in the bill

### 12.2 Shared item splitting

If an item is assigned to multiple people, the default split is equal.

Example:

```text
Pizza: RM48
Assigned to: User, Alex, Jason
Each share: RM16
```

A future version may allow manual unequal item splitting.

### 12.3 Validation

The system should verify:

```text
Sum of item prices
− item-specific discounts
+ bill-level charges
− bill-level discounts
+ rounding adjustments
= final bill total
```

The system must also verify:

```text
User's final portion
+ all friends' final portions
= final bill total
```

Any difference should be clearly shown as unassigned or unresolved.

---

## 13. Tax, Service Charge, Discount, and Voucher Rules

### 13.1 Default distribution

Default behaviour:

- Tax: proportional to each person's item subtotal
- Service charge: proportional to each person's item subtotal
- Whole-bill discount: proportional to each person's item subtotal
- Item-specific discount: applied only to the people assigned to that item
- Rounding adjustment: assigned to the user by default

### 13.2 Alternative distribution methods

The user should be able to choose:

- Proportional
- Equal
- Selected people only
- Manual allocation

### 13.3 Personal voucher

A personal voucher may benefit only the user.

The app should support:

- Share discount among everyone
- Benefit the user only
- Manual allocation

### 13.4 Cashback

Cashback should not automatically reduce friends' portions.

Default treatment:

- Cashback belongs to the user
- It is recorded separately from the original bill
- It does not rewrite the original bill breakdown unless the user chooses to apply it

### 13.5 Suggested calculation order

A consistent order should be used:

1. Calculate each person's item subtotal
2. Apply item-specific discounts
3. Apply bill-level discounts
4. Apply service charge
5. Apply tax
6. Apply rounding adjustment
7. Confirm final total
8. Save each person's final portion

The actual implementation must match the bill's real calculation method where necessary.

---

## 14. Friends and Outstanding Balances

### 14.1 Friend profile

Each friend should have:

- Name
- Optional nickname
- Optional phone number
- Optional notes
- Total unrequested amount
- Total requested amount
- Total paid amount
- Current outstanding amount

### 14.2 Friend ledger

Each friend's page should show:

- Shared bill date
- Bill description
- Amount owed
- Payment-request status
- Payment-request reference
- Settlement date
- Historical payment requests

### 14.3 Only track money owed to the user

The MVP only tracks:

- Friends owing the user

It does not track:

- User owing friends

That responsibility remains outside the app for the first version.

---

## 15. Payment Request Rules

### 15.1 Lump-sum payment only

The user will request one lump-sum payment from a friend.

Partial repayment is not supported in the MVP.

A payment request is either:

- Pending
- Paid in full
- Cancelled
- Forgiven

### 15.2 Payment request snapshot

When the user creates a payment request, the system must save a snapshot containing:

- Friend
- Included bills
- Included bill portions
- Total requested amount
- Request date
- Status
- Optional note
- Paid date

New bills added after the request must not change the existing request total.

They remain unrequested and will be included in a later request.

### 15.3 Editing requested bills

Once a bill portion is included in a payment request:

- The included amount should be locked
- To edit it, the payment request must first be cancelled
- After cancellation, the bill can be corrected
- A new payment request can then be created

### 15.4 Mark as paid

When the friend pays the full requested amount:

- User marks the payment request as paid
- All included bill portions become settled
- The payment date is recorded
- The repayment is not counted as income
- The friend's outstanding balance is updated

### 15.5 Request statuses

Friend-related bill portions may have:

- Unrequested
- Requested
- Paid
- Forgiven
- Cancelled

---

## 16. Payment Request Summary

The app should generate a copyable summary.

Example:

```text
Hey, these are the pending amounts:

10 Jul — Dinner: RM62.40
14 Jul — Movie: RM18.00
20 Jul — Supper: RM9.50

Total: RM89.90
```

The MVP only needs to support copying the message.

Automatic sending is not required.

---

## 17. Historical Views and Reports

Historical viewing is a core MVP feature.

### 17.1 Supported time ranges

The user should be able to view:

- Today
- Specific date
- This week
- Previous week
- Current month
- Previous month
- Specific month
- Custom date range
- Year to date
- Specific year

### 17.2 Historical financial summary

For a selected period, show:

```text
Income received
− commitments
− savings
− investments
− personal spending
= remaining spendable amount
```

Also show:

```text
Total amount paid
User's actual portion
Amount paid for friends
Amount requested from friends
Amount collected from friends
Amount still outstanding
```

### 17.3 Historical drill-down

The user should be able to navigate:

```text
Month
→ category
→ transaction
→ bill items
→ friend portions
→ payment request
```

### 17.4 Backdated entries

The user may add a forgotten expense later.

Required behaviour:

- Expense date determines the financial period
- Recorded date is stored separately
- Historical reports update to include the backdated transaction
- Audit information should show when it was actually entered

### 17.5 Historical configuration changes

If salary or commitments change later:

- Previous months remain unchanged
- New values apply only from their effective dates
- Recurring templates do not overwrite historical generated records

### 17.6 Monthly comparison

Reports should support comparing periods.

Examples:

- Current month versus previous month
- Category changes
- Spending increase or decrease
- Commitment changes
- Savings-rate changes
- Outstanding friend balances

---

## 18. Month or Period Rollover

At the start of a new financial period:

- Recurring salary entry is generated
- Recurring commitments are generated
- Recurring savings are generated
- Recurring investments are generated
- Unpaid friend balances carry forward
- Unrequested friend portions carry forward
- Pending payment requests remain pending
- Previous personal spending stays in its original period
- Remaining spendable amount resets for the new period

Unused budget should not automatically become income.

A future option may allow carry-forward, but it should be off by default.

---

## 19. Main Screens

### 19.1 Home

Purpose:

- Show the current financial position
- Show remaining spendable money
- Show alerts and pending items

Main elements:

- Period selector
- Remaining spendable card
- Income summary
- Commitment summary
- Savings and investment summary
- Personal spending summary
- Friends owe summary
- Upcoming commitments
- Unresolved transactions
- Pending payment requests

### 19.2 Add

Entry types:

- Income
- Commitment
- Savings allocation
- Investment allocation
- Personal expense
- Shared expense
- Friend repayment

### 19.3 Transactions

Features:

- Transaction list
- Search
- Filters
- Edit
- Delete or archive
- Resolve shared transaction
- View bill breakdown

Filters:

- Date range
- Category
- Payment method
- Personal or shared
- Resolved or unresolved
- Friend
- Payment-request status

### 19.4 Friends

Features:

- Friend list
- Outstanding amount per friend
- Unrequested amount
- Requested amount
- Payment-request history
- Create lump-sum payment request
- Mark payment request as paid
- Copy payment summary

### 19.5 Monthly Plan

Features:

- Salary
- Recurring commitments
- Savings allocations
- Investment allocations
- Effective dates
- Expected payment dates
- Active or inactive status

### 19.6 Reports

Features:

- Period selection
- Summary
- Spending categories
- Personal versus shared outflow
- TNG versus cash
- Friend outstanding history
- Income breakdown
- Commitment breakdown
- Month comparison

### 19.7 Settings

Possible settings:

- Currency
- Financial-period type
- Salary date
- Default payment method
- Default discount allocation
- Default tax allocation
- Default service-charge allocation
- Categories
- Data export
- Backup
- Theme

---

## 20. Suggested Mobile Navigation

Recommended main navigation:

```text
Home | Transactions | Add | Friends | More
```

The Add action should be visually prominent.

The More section may contain:

- Monthly Plan
- Reports
- Settings
- Export
- Help

---

## 21. Suggested Categories

Initial categories may include:

- Food and drinks
- Groceries
- Transport
- Shopping
- Entertainment
- Health
- Personal care
- Family
- Housing
- Utilities
- Insurance
- Subscriptions
- Travel
- Gifts
- Savings
- Investments
- Other

The user should be able to add, rename, hide, and reorder categories later.

---

## 22. Data Model

The exact implementation may change, but the core entities should include the following.

### 22.1 User

Fields:

- ID
- Name
- Email
- Currency
- Time zone
- Default period type
- Salary-cycle start day
- Default payment method
- Created date
- Updated date

### 22.2 Financial Period

Fields:

- ID
- User ID
- Start date
- End date
- Period type
- Status
- Optional locked date

### 22.3 Income Template

Fields:

- ID
- User ID
- Name
- Default amount
- Income type
- Recurrence
- Expected day
- Start date
- End date
- Active status

### 22.4 Income Entry

Fields:

- ID
- User ID
- Template ID
- Amount
- Income type
- Transaction date
- Recorded date
- Confirmed status
- Notes

### 22.5 Commitment Template

Fields:

- ID
- User ID
- Name
- Default amount
- Commitment type
- Category
- Recurrence
- Due day
- Start date
- End date
- Fixed or estimated
- Active status

### 22.6 Commitment Entry

Fields:

- ID
- User ID
- Template ID
- Amount
- Due date
- Paid date
- Status
- Recorded date
- Notes

### 22.7 Transaction

Fields:

- ID
- User ID
- Description
- Merchant
- Total amount paid
- Transaction date
- Recorded date
- Payment method
- Category
- Transaction type
- Personal or shared
- Resolved status
- Notes
- Created date
- Updated date

### 22.8 Bill Item

Fields:

- ID
- Transaction ID
- Name
- Quantity
- Unit price
- Total price
- Item-specific discount
- Notes

### 22.9 Friend

Fields:

- ID
- User ID
- Name
- Nickname
- Phone
- Notes
- Active status

### 22.10 Bill Participant

Fields:

- ID
- Transaction ID
- Person type
- Friend ID
- Item subtotal
- Discount share
- Service-charge share
- Tax share
- Rounding share
- Final portion
- Settlement status
- Payment-request ID

The user should be represented as a participant as well.

### 22.11 Bill Item Assignment

Fields:

- ID
- Bill Item ID
- Participant ID
- Split method
- Assigned amount
- Assigned percentage

### 22.12 Bill Adjustment

Fields:

- ID
- Transaction ID
- Adjustment type
- Name
- Amount
- Distribution method
- Beneficiary
- Calculation order

Adjustment types may include:

- Discount
- Voucher
- Service charge
- Tax
- Rounding
- Other fee

### 22.13 Payment Request

Fields:

- ID
- User ID
- Friend ID
- Total amount
- Request date
- Status
- Paid date
- Cancelled date
- Message snapshot
- Notes

### 22.14 Payment Request Item

Fields:

- ID
- Payment Request ID
- Bill Participant ID
- Transaction description snapshot
- Transaction date snapshot
- Amount snapshot

### 22.15 Category

Fields:

- ID
- User ID
- Name
- Type
- Sort order
- Active status

---

## 23. Calculation Rules

### 23.1 Personal spending

```text
Personal spending
= Sum of the user's final portions for personal and resolved shared expenses
```

### 23.2 Paid on behalf of friends

```text
Paid for friends
= Sum of all friends' final portions
```

### 23.3 Friend outstanding

```text
Friend outstanding
= Unrequested portions
+ pending requested portions
− paid portions
− forgiven portions
```

### 23.4 Remaining spendable

```text
Remaining spendable
= confirmed income
− commitments
− savings
− investments
− personal spending
```

### 23.5 Total cash outflow

```text
Total cash outflow
= personal expenses
+ full shared bills paid
+ commitments paid
+ savings transfers
+ investment transfers
```

### 23.6 Friend repayments

Friend repayments:

- Reduce outstanding receivables
- Increase actual available cash
- Do not increase income
- Do not reduce the original period's personal spending
- Are linked to a specific payment request

---

## 24. Validation and Error Handling

The application should prevent or warn about:

- Final bill total not matching item and adjustment calculations
- Participant portions not matching final bill total
- Creating a payment request with no unrequested items
- Including the same friend portion in multiple active payment requests
- Editing a bill already included in a pending request
- Marking a request paid with a mismatched amount
- Negative amounts where not allowed
- Duplicate recurring entries
- Missing required dates
- Invalid date ranges
- Deleting records used in historical reports without confirmation

---

## 25. Notifications and Reminders

Possible MVP reminders:

- Commitment due soon
- Recurring commitment not marked paid
- Unresolved shared bill
- Friend amount not yet requested
- Pending payment request
- Salary entry not confirmed
- Monthly review reminder

Notifications should be optional.

Automatic reminders to friends are not part of the MVP.

---

## 26. Search, Filtering, and Sorting

The app should support:

- Search by description
- Search by merchant
- Search by friend
- Filter by date
- Filter by category
- Filter by payment method
- Filter by personal or shared
- Filter by resolved status
- Filter by payment-request status
- Sort by date
- Sort by amount
- Sort by newest recorded
- Sort by friend outstanding

---

## 27. Data Export and Backup

The user should be able to export data.

Recommended MVP export formats:

- CSV for transactions
- CSV for friend balances
- CSV for payment requests
- JSON full backup

A later version may support:

- Excel workbook
- PDF monthly report
- Automatic cloud backup
- Import from CSV

---

## 28. PWA Requirements

The application should:

- Be installable on mobile and desktop
- Have a web app manifest
- Use a service worker
- Support responsive layouts
- Open in standalone mode when installed
- Cache the application shell
- Allow basic offline entry
- Sync offline records after reconnection
- Prevent duplicate sync submissions
- Show sync status
- Preserve unsaved form data where practical

---

## 29. Security and Privacy

Because the app contains personal financial data:

- Authentication is required
- Data must be isolated per user
- Database access must use row-level security
- Sensitive secrets must not be stored in frontend code
- Production traffic must use HTTPS
- Backups should be protected
- Export files should be generated only when requested
- Friends should not see the user's full financial information

If public bill links are added later:

- Use unguessable tokens
- Show only the relevant bill
- Allow link revocation
- Avoid exposing unrelated friend or financial data

---

## 30. Suggested Technical Direction

Initial recommended stack:

```text
Frontend: React or Next.js
Language: TypeScript
UI: Responsive component library or custom design system
PWA: Web app manifest + service worker
Backend: Supabase
Database: PostgreSQL
Authentication: Supabase Auth
Hosting: Vercel
Offline storage: IndexedDB
Validation: Shared TypeScript schemas
```

The stack can be changed later, but a relational database is recommended because the app contains many relationships between:

- Transactions
- Bill items
- Friends
- Participants
- Adjustments
- Payment requests
- Historical periods

---

## 31. MVP Scope

### Included

1. Personal login
2. RM currency
3. Fixed salary
4. Variable KPI income
5. Other confirmed income
6. Recurring commitments
7. Savings allocations
8. Investment allocations
9. Remaining spendable calculation
10. TNG and cash payment methods
11. Personal expense entry
12. Shared expense entry
13. Save shared bill as unresolved
14. Bill-item entry
15. Assign items to people
16. Equal splitting of shared items
17. Proportional tax calculation
18. Proportional service-charge calculation
19. Discount and voucher allocation
20. Friend profiles
21. Friend outstanding balance
22. Lump-sum payment request
23. Payment request snapshot
24. Pending, paid, cancelled, and forgiven statuses
25. No partial repayments
26. Copyable payment request summary
27. Historical month and date-range views
28. Backdated entries
29. Monthly comparison
30. Basic reporting
31. PWA installation
32. Basic offline support
33. Data export

### Excluded from MVP

1. AI natural-language entry
2. AI receipt understanding
3. Automatic OCR-based bill parsing
4. Bank integration
5. TNG API integration
6. Exact cash-wallet reconciliation
7. Credit card statement reconciliation
8. Partial friend repayments
9. Tracking amounts the user owes friends
10. Multiple currencies
11. Collaborative friend login
12. Automatic WhatsApp sending
13. Investment performance tracking
14. Net worth tracking
15. Advanced forecasting
16. Automatic subscription detection

---

## 32. Future Features

Possible future enhancements:

- Receipt image attachment
- OCR-assisted bill entry
- AI-assisted bill parsing
- Natural-language entry
- Friend bill-viewing links
- Friend confirmation
- Shared travel groups
- Automatic reminders
- WhatsApp integration
- Bank statement import
- TNG transaction import
- Credit card tracking
- Multiple currencies
- Savings goals
- Net worth
- Investment tracking
- Budget category limits
- Financial forecasting
- Unusual-spending detection
- Subscription detection
- Monthly PDF reports
- Advanced charts
- Biometric authentication
- Home-screen widgets

---

## 33. Open Decisions

The following items are not yet final:

### 33.1 Default budget period

**Resolved:** Use the calendar month.

The financial period runs from the first day to the final day of each month.

Salary date remains a separate setting for reminders and reference only.

### 33.2 Rounding allocation

**Resolved:** Assign the rounding difference to the user by default.

The app may support alternative allocation methods later, but the MVP uses
this simple, deterministic default.

### 33.3 Unresolved bill dashboard calculation

Decide whether unresolved shared bills should:

- Temporarily count the full amount as personal spending
- Be excluded from personal spending until resolved
- Use an estimated personal portion
- Show a separate warning only

**Resolved:**

- Show full cash outflow
- Exclude it from final personal-spending calculation
- Display a prominent unresolved warning

### 33.4 Historical period locking

Decide whether past periods should:

- Remain editable forever
- Be manually locked
- Be automatically locked after a set number of days

Recommended default:

- Keep editable
- Record all modifications
- Add manual locking later

### 33.5 Friend identity

For MVP, a friend only needs a name.

Optional fields such as phone number can be added but should not be compulsory.

### 33.6 Spendable-money treatment of commitments

**Resolved:** Subtract all active monthly commitments from remaining spendable
money, whether or not they have been paid yet.

This makes the dashboard a conservative guide to the amount the user can
responsibly spend during the month, rather than a reflection of the current
bank or e-wallet balance.

### 33.7 Offline support delivery

**Resolved:** Build the core app with an offline-ready local data layer first.
Robust background synchronization and conflict handling will follow after the
core calculations and workflows are validated.

---

## 34. Initial User Flow

### 34.1 First-time setup

1. Create account
2. Set RM as currency
3. Select financial-period type
4. Enter base salary
5. Enter salary date
6. Add commitments
7. Add savings allocations
8. Add investment allocations
9. Add common categories
10. Add default payment methods
11. Open dashboard

### 34.2 Personal expense

1. Tap Add
2. Select Personal Expense
3. Enter amount
4. Enter description
5. Select date
6. Select category
7. Select TNG or cash
8. Save

### 34.3 Shared bill

1. Tap Add
2. Select Shared Expense
3. Enter total amount and description
4. Select date and payment method
5. Add people
6. Add bill items
7. Assign people to each item
8. Enter discount, voucher, tax, and service charge
9. Review calculated portions
10. Save

Alternative:

1. Enter basic bill details
2. Select Calculate Later
3. Save as unresolved
4. Resolve later

### 34.4 Request payment

1. Open Friends
2. Select friend
3. Review unrequested items
4. Select all items to include
5. Create lump-sum request
6. Copy generated summary
7. Send manually
8. Request remains pending

### 34.5 Record payment

1. Open pending payment request
2. Confirm full amount received
3. Mark as paid
4. All included items become settled

### 34.6 View previous month

1. Open Home or Reports
2. Change period
3. Select previous month
4. Review income, commitments, savings, spending, and friend amounts
5. Drill into categories and transactions

---

## 35. Definition of a Successful MVP

The MVP is successful if the user can consistently:

- Know how much money remains safe to spend
- Record a normal expense in a few seconds
- Save a shared bill without calculating it immediately
- Assign restaurant items to friends
- Calculate tax, service charge, and discounts fairly
- See how much each friend owes
- Request one lump-sum payment
- Mark the full request as paid
- Review previous months accurately
- Correct forgotten or backdated expenses
- Use the app comfortably from a mobile home screen

---

## 36. Project Working Rules

At the start of each development or planning session:

1. Read this file first
2. Treat it as the current source of truth
3. Check the Open Decisions section
4. Do not introduce conflicting behaviour without discussing it
5. Update this file when a product decision changes
6. Add a changelog entry after meaningful changes
7. Keep MVP and future scope separate
8. Preserve agreed calculation rules

When there is confusion:

- Refer to the relevant section
- Identify whether the requirement is final or still open
- Propose an update
- Update the file only after the new decision is accepted

---

## 37. Changelog

### Version 0.3 — Core Calculation Decisions Confirmed

Changed:

- Set the default rounding adjustment to the user's portion
- Confirmed that unresolved shared bills count as cash outflow but not final
  personal spending
- Confirmed that remaining spendable money subtracts active monthly
  commitments before they are paid
- Staged offline delivery: offline-ready local storage first, robust sync
  after the core workflows are validated

### Version 0.2 — Financial Period Confirmed

Changed:

- Set the default financial period to the calendar month
- Confirmed that monthly reporting runs from the first to the final day of each month
- Kept salary date as a separate reminder and reference setting
- Removed salary-cycle selection from the MVP scope

---

### Version 0.1 — Initial Product Definition

Added:

- Core financial dashboard concept
- Fixed salary and variable KPI income
- Commitments, savings, and investments
- Personal and shared expenses
- Bill-item assignment
- Tax, service charge, discount, and voucher rules
- Friend outstanding tracking
- Lump-sum payment requests
- No partial repayments
- Payment-request snapshots
- Historical month and date-range reporting
- Backdated transactions
- MVP scope
- Initial data model
- Technical direction
- Open decisions

---

## 38. Next Recommended Step

The next phase should produce:

1. Detailed user stories
2. Screen-by-screen wireframe specification
3. Database schema
4. Calculation examples and test cases
5. API and service boundaries
6. MVP development roadmap
7. Repository structure
8. Initial UI prototype
