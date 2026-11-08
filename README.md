# Real Estate Buy/Sell Planner

**Decide when to hold, sell, or sell-and-buy (1031) each rental property.** Built for financial advisors: drop in a client's tax return and the planner reads Schedule E, builds the property portfolio, and models hold, sell, 1031 exchange and step-up for every property, so the advisor walks into the meeting with after-tax numbers instead of a spreadsheet.

> An independent concept project by James Gu, exploring the AI-assisted real estate planning workflow for advisors. Not affiliated with or endorsed by any company. The demo client is fictional.

## What it does

1. **Upload the return** (PDF up to 4 MB). Claude reads the PDF and extracts every Schedule E property: rents, expenses, mortgage interest, depreciation, and basis or placed-in-service dates if a depreciation schedule is attached. The output is schema-constrained (structured outputs + Zod), so the app always gets typed data back. The PDF is processed in memory and never written to disk.
2. **Fill the gaps honestly.** A return doesn't show market value or loan balance. The planner estimates them (for example, building basis backed out of straight-line depreciation, loan balance from interest paid) and **flags every estimate** so the advisor confirms it with the client. Edits flow through every model on the page.
3. **See the portfolio.** Value, equity, after-tax cash flow and the tax bill if sold today, per property and in total, with planning signals: large embedded gain, low return on equity, negative cash flow, depreciation running out, high leverage, passive losses.
4. **Compare strategies.** For each property, year-by-year after-tax wealth for:
   - **Hold, then sell:** cash flow reinvested, sold at the end of the horizon
   - **Sell today:** net proceeds reinvested
   - **1031 exchange:** equity rolls into a replacement property with carryover basis; tax deferred
   - **Hold for step-up:** the gain disappears at death (shown, never ranked "best", since it depends on the estate plan)
5. **Draft the meeting brief.** Claude turns the computed numbers into talking points, questions for the client and caveats to confirm. The model explains the math; it never does the math.
6. **Export a fact sheet** with the fields eMoney, RightCapital and MoneyGuide ask for: print to PDF or copy as CSV.
7. **Keep every client.** Advisors sign in, and each client's portfolio and assumptions are saved to their account. Edits autosave; the client list picks up where the last meeting left off.

## The tax model

`lib/engine.ts` is deterministic and unit tested (`lib/engine.test.ts`). On a sale it computes:

| Component | Treatment |
|---|---|
| Amount realized | Sale price less selling costs |
| Adjusted basis | Cost basis less accumulated depreciation |
| Unrecaptured §1250 gain | Lesser of gain and depreciation taken, at the ordinary rate capped at 25% |
| Remaining gain | Long-term capital gains rate (0 / 15 / 20%) |
| NIIT | 3.8% on the full gain, if the client is subject to it |
| State | Flat state rate on the full gain |

Annual rental income is taxed at the ordinary + state (+ NIIT) rate. Tax losses are treated as suspended passive losses with no current benefit, the conservative read for most high-income clients. These are planning approximations, not tax preparation: no AMT, no installment sales, no partial exchanges or boot, no estate tax.

## Architecture

```
app/
  page.tsx                  single-page workspace
  api/extract/route.ts      PDF → Claude (structured output) → Portfolio
  api/brief/route.ts        computed comparison → Claude → meeting brief
  api/auth/*                signup, login, logout, me
  api/clients[/id]          list, create, read, update, delete saved clients
components/                 Intake, AuthForm, SavedClients, PortfolioView, PropertyView, StrategyChart, FactSheet, Settings
lib/
  engine.ts                 sale tax, cash flow, strategy projections (pure functions)
  signals.ts                planning signals per property
  extraction.ts             Schedule E schema, prompt, raw → Property normalization
  claude.ts                 SDK client, model, refusal fallback, error mapping
  db.ts                     SQLite connection and schema
  accounts.ts               advisors, sessions, saved clients (all queries scoped to the advisor)
  session.ts                session cookie handling for route handlers
  schema.ts                 Zod validation for everything the browser sends to be saved
```

- **Next.js 16 (App Router) + React 19 + TypeScript**, no UI framework: hand-written CSS with light and dark themes and a print stylesheet.
- **Claude Opus 5.5** via `@anthropic-ai/sdk`, using `messages.parse` with Zod schemas for typed output and server-side refusal fallback.
- **SQLite via libSQL** (`@libsql/client`), no ORM. Locally it's a file at `data/planner.db`; in production it's a hosted [Turso](https://turso.tech) database, because serverless hosts have no persistent disk. Same SQL either way.
- **Auth** is small and explicit: scrypt password hashes, random session tokens stored only as SHA-256 hashes, an HttpOnly SameSite=Lax cookie, and one error message for every failed login so it doesn't reveal which emails have accounts.
- **Tenant isolation**: every client query includes the advisor's id, so another advisor's client returns the same 404 as a missing one. Tests cover it.
- **What's stored**: the extracted figures and assumptions only. The tax-return PDF is processed in memory and never written to disk.
- The Claude routes require sign-in, so an anonymous visitor can't spend the API key. The demo client works signed out.
- The strategy chart is plain SVG with a hover crosshair, direct end labels and a table view.

## Running it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY to enable upload and briefs
npm run dev
```

Open http://localhost:3000 and create an account; the database is created on first run. **Explore a demo client** works signed out and without an API key; `/?demo` jumps straight to it.

```bash
npm test          # engine, auth and saved-client tests
npm run typecheck
npm run build
```

## Deploying to Vercel

Everything runs on Vercel's free Hobby plan with a free Turso database.

1. **Create the database.** Sign up at [turso.tech](https://turso.tech), create a database, then copy its URL (`libsql://…`) and create a token for it. The tables are created automatically on first request.
2. **Import the repo** at [vercel.com/new](https://vercel.com/new). Vercel detects Next.js; keep the defaults.
3. **Add environment variables** in the import screen (or Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | `libsql://your-db-name-your-org.turso.io` |
   | `TURSO_AUTH_TOKEN` | the database token |
   | `ANTHROPIC_API_KEY` | your Anthropic key |

4. **Deploy.** Open the URL, create an account, and upload a return or open the demo client.

Notes:
- Anyone with the link can create an account and spend the Anthropic key on uploads and briefs. Set a monthly spend limit in the Anthropic console.
- Uploads are capped at 4 MB because Vercel rejects request bodies over 4.5 MB.
- Reading a return can take up to a minute; the extract route allows 300 seconds, the Hobby plan maximum.

## License

MIT
