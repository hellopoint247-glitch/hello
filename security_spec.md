# Security Specifications & Hardening Plan

This specification establishes a Zero-Trust attribute-based security policy for the Hello Point database.

## Data Invariants
1. A user's contact list, ledger transactions, and cashbook records belong exclusively to their authenticated Google session (`request.auth.uid`).
2. No user can read, list, create, update, or delete another user's documents.
3. Every document modified must undergo precise schema and structure validation using type-safe validation helpers.

## The Dirty Dozen Payloads (Abuse Scenarios)
1. Injecting another user's `userId` inside the path during creation.
2. Creating a transaction with a negative amount.
3. Updating the immutable `createdAt` timestamp.
4. Elevating custom roles or bypassing permissions on another user's ledger sheet.
5. Spoofing user registration without verified email credentials.
6. Triggering excessively large string writes to exhaust database index quotas (Poisoning IDs or strings).
7. Modifying transaction details of a finalized historical ledger entry (Terminal states locking).
8. Listing transactions without proper authorization queries.
9. Modifying properties inside a deleted transaction.
10. Creating transactions referencing non-existent customers.
11. Reading PII details of random contacts on the server.
12. Creating entries with unverified client-side timestamps.

## Security Rule Blueprint
All writes are governed by the user-ownership model. Every path enforces `userId == request.auth.uid`.
