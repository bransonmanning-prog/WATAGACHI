# WATAGACHI ERP — GitHub Pages package

This is the current static WATAGACHI ERP demo. It is plain HTML, CSS, and JavaScript. `index.html` is the sign-in preview page; `app.html` contains the ERP and customer pickup preview. Keep `modules.js`, `assets/`, and `supabase/` beside them in the repository root.

## Publish with GitHub Pages

1. Upload these files and folders to the root of a GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select your default branch (usually `main`) and folder **/(root)**, then save.

## Demo login status

The login screen is for presentation only. It accepts any valid email and non-empty password; it does not verify or create accounts. Do not put private data in this demo.

Supabase is not connected yet. Before using the `supabase/schema.sql` file, reconcile the ERP snapshot schema with the teammate customer-portal schema and tighten the role-based access policies. Never place a Supabase secret or service-role key in browser code. Use a publishable key only after the database policies are ready.

## Files

- `index.html` — demo login entry page
- `app.html` — ERP and customer pickup views
- `modules.js` — ERP operations, demo login session, and data behavior
- `assets/` — WATAGACHI wordmark and buddy logo
- `supabase/schema.sql` — current ERP database draft; do not run until schema and permissions are reconciled
