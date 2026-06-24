# BFHL Hierarchy API + Frontend

Round 1 submission for the **Chitkara Full Stack Engineering Challenge**.

A REST API (`POST /bfhl`) that accepts an array of edge strings, validates them,
builds independent trees, detects cycles, and returns structured insights — plus
a single-page frontend to interact with it.

## Stack

- **Backend:** Node.js + Express (with CORS enabled)
- **Frontend:** Plain HTML / CSS / JS (served from the same server)
- No build step required.

## Project structure

```
.
├── server.js              # Express app: /bfhl route, CORS, static frontend
├── src/processor.js       # Core hierarchy-processing logic
├── public/                # Single-page frontend (index.html, styles.css, script.js)
├── test/processor.test.js # Unit tests for the processing rules
├── vercel.json            # Vercel deployment config
└── package.json
```

## Run locally

```bash
npm install
npm start          # serves API + frontend at http://localhost:3000
```

- API endpoint: `http://localhost:3000/bfhl`
- Frontend: `http://localhost:3000`

Run the tests:

```bash
npm test
```

## API

### `POST /bfhl`

Request:

```json
{ "data": ["A->B", "A->C", "B->D"] }
```

Response (shape):

```json
{
  "user_id": "fullname_ddmmyyyy",
  "email_id": "your@college.edu",
  "college_roll_number": "ROLL123",
  "hierarchies": [
    { "root": "A", "tree": { "A": { "B": { "D": {} }, "C": {} } }, "depth": 3 },
    { "root": "X", "tree": {}, "has_cycle": true }
  ],
  "invalid_entries": ["hello"],
  "duplicate_edges": ["A->B"],
  "summary": { "total_trees": 1, "total_cycles": 1, "largest_tree_root": "A" }
}
```

### Processing rules implemented

- **Valid edge:** `X->Y`, single uppercase letters; whitespace trimmed first.
- **Invalid** (→ `invalid_entries`): bad format, non-letters, multi-char nodes,
  wrong separator, missing child, self-loops (`A->A`), empty strings.
- **Duplicates:** first occurrence of a `Parent->Child` pair is used for the
  tree; later occurrences are reported once in `duplicate_edges`.
- **Multi-parent / diamond:** the first-encountered parent for a child wins;
  later parent edges for that child are silently discarded.
- **Trees:** a root is any node that never appears as a child; multiple
  independent trees are returned separately.
- **Cycles:** cyclic groups return `has_cycle: true` and `tree: {}` (no `depth`).
  A pure cycle uses the lexicographically smallest node as its root.
- **Depth:** number of nodes on the longest root-to-leaf path.
- **Summary:** `total_trees` counts non-cyclic trees; `largest_tree_root`
  tiebreaks on the lexicographically smaller root.

## Identity fields

`user_id`, `email_id`, and `college_roll_number` are set in `server.js` and can
be overridden with environment variables:

```
USER_ID=yourname_ddmmyyyy
EMAIL_ID=you@college.edu
COLLEGE_ROLL_NUMBER=YOURROLL
```

> Update these to your real credentials before submitting.

## Deploy

**Render / Railway (recommended for Express):**

- Build command: `npm install`
- Start command: `npm start`
- The platform sets `PORT` automatically; the server reads `process.env.PORT`.

**Vercel:** `vercel.json` routes all traffic to `server.js`.

After deploying, the evaluator calls `<your-url>/bfhl`. The frontend defaults its
endpoint to the same origin, so a single deployment serves both.
