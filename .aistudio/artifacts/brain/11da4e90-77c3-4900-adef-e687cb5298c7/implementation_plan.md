# Category Tags: English Filter & 1-Month Auto-Cleanup Plan

Automatic filtration of English-letter tags from category suggestions and automated cleanup of tags unused for more than 1 month (including favorite tags).

### User Review & Critical Decisions

> [!IMPORTANT]
> The following rules were confirmed via clarifying choices:
> - **English Filter Rule**: Any tag containing English Latin characters (`[a-zA-Z]`) is strictly excluded from being saved or accumulated in category tags.
> - **Favorite Tags Expiration**: Even tags marked as favorite (⭐) will be automatically deleted if they remain unused for 1 month (30 days).
> - **Existing Tags Strategy**: Pre-existing English tags are not deleted immediately; only new English tag registrations are blocked (existing tags will expire normally if unused for 1 month).

---

## 1. Overview & Core Concept

- **What It Does**:
  1. Prevents any text with English letters (`[a-zA-Z]`) entered in the transaction note or tag input from being saved into the category tags pool or suggested as a persistent tag.
  2. Tracks the last usage and transaction references for each tag.
  3. Periodically purges tags that have not been used in any transaction within the last 30 days (1 month), removing them from custom tags, favorite tags, and category overrides.
- **Target Audience**: Store owners and ledger operators who write transaction notes in Bengali and occasionally English, keeping the tag section clean, relevant, and exclusively focused on active Bengali categories.
- **Key Value**: Clutter-free tag section with zero unwanted English entries and automated housekeeping that removes stale tags.

---

## 2. User Experience & Visual Design

- **Tag Suggestion & Manual Adding**:
  - When typing a note in English (or mixed English and Bengali like `Bkash` or `Cash`), the "➕ Save as category" button will not appear.
  - If a user manually tries to add an English tag in the tag manager modal, an alert/feedback banner informs them: `"⚠️ ইংরেজি বর্ণের ট্যাগ সেভ করা যাবে না"` (English tags cannot be saved).
- **Tag Suggestions Grid**:
  - Only clean, non-English, active Bengali tags appear in the categorized chips and suggestions.
- **Automatic Housekeeping**:
  - Runs silently on app launch and transaction updates. Stale tags older than 30 days without transaction usage smoothly disappear from the quick-tag bar and category manager.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: English Letter Detection (`/[a-zA-Z]/`)**
  - *Chosen Approach*: Check for any ASCII letter `/[a-zA-Z]/` using a robust helper `hasEnglishLetters(str: string): boolean`.
  - *Why*: User confirmed "ইংরেজি বর্ণ (A-Z) বিশিষ্ট যেকোনো ট্যাগ বাদ দেওয়া" to prevent mixed English/Banglish clutter.
  - *Alternatives Considered*: Checking purely English words vs mixed words; user selected any tag with English letters.
- **Decision 2: 1-Month Unused Tracking & Cleanup**
  - *Chosen Approach*: Maintain a `hellopoint_tag_last_used` timestamp mapping (`Record<string, number>`) in localStorage and Firestore (`tagLastUsed`), paired with an inspection of transactions from the last 30 days.
  - *Evaluation*: A tag is marked as expired if its `lastUsed` timestamp is older than 30 days AND it does not appear in any transaction note created within the last 30 days.
  - *Favorites Handled*: Consistent with user's answer, favorite tags that are unused for 30 days will also be cleaned up.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Note Input / Tag Modal                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
            hasEnglishLetters(tag) === true ?
               [YES] ──► Block saving to customCategories
               [NO]  ──► Save to customCategories & record usage
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Tag Expiration Engine                    │
│   - Check transactions within last 30 days                  │
│   - Compare tagLastUsed timestamps against 30-day cutoff    │
│   - Prune expired tags from customCategories, favorites,    │
│     tagOverrides, and sync to localStorage & Firestore      │
└─────────────────────────────────────────────────────────────┘
```

### Proposed Changes

1. **Tag Helpers (`src/components/TransactionForm.tsx` & `src/App.tsx`)**:
   - Add `hasEnglishLetters(str: string): boolean` helper checking `/[a-zA-Z]/.test(str)`.
   - Update `handleSaveNewCategory`, `handleAddNewTagToActiveFilter`, and `handleSavingTransaction` to reject any tag containing English letters.
   - Update tag suggestion button (`➕ সেভ করুন`) to hide when query contains English letters.
   - Update `handleSaveCategory` in `App.tsx` to guard against English tags before syncing to Firestore.

2. **1-Month Unused Tag Cleanup (`src/App.tsx` & `src/components/TransactionForm.tsx`)**:
   - Maintain `tagLastUsedMap: Record<string, number>` in storage and user Firestore doc.
   - On app startup and tag loading, check all existing categories:
     - Check if tag exists in any transaction from the last 30 days. If found, update its last used timestamp.
     - If a tag was created or last used > 30 days ago and has not appeared in any transaction in the last 30 days, purge it from:
       - `customCategories`
       - `favoriteTags`
       - `tagOverrides`
       - `recentUsageOrder`
   - Sync updated lists to `localStorage` and Firestore (`users/{uid}`).

---

## 5. Verification Plan

- **English Detection Test**:
  - Type English note (e.g. `Bkash`, `Due`, `Payment`) -> verify "➕ Save as category" button does not show and tag is not auto-saved.
  - Try manually adding an English tag in the tag modal -> verify it rejects and shows validation feedback.
  - Type Bengali note (e.g. `বকেয়া বিল`, `মালামাল বিক্রয়`) -> verify it saves and shows normally in tags.
- **1-Month Expiration Test**:
  - Simulate a tag whose last usage and transaction appearance is older than 30 days -> verify it is automatically pruned from custom tags and favorite tags.
  - Verify tags actively used within 30 days remain untouched.
- **Build Verification**:
  - Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.
