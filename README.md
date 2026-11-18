# WATAGACHI ERP Prototype

A static, editable ERP demo for the smart hydration team. It preserves the original blue-gray MRP and financial pages and adds operational pages for the other rubric sections.

## Run locally

Open `index.html` in a modern browser. It now starts on a demo-only login screen; enter any email and password to preview the team ERP or customer pickup view. The preview does not verify accounts. The full ERP is in `app.html`. Keep `modules.js` and `supabase/schema.sql` next to it. The only external browser library is JsBarcode from jsDelivr for printable Code 128 labels; USB scanners can also enter a barcode and press Enter. Camera scanning depends on browser support and camera permission.

Demo edits are stored in browser `localStorage` under `watagachi-erp-demo-v2`. Separate browsers/devices do not share demo changes.

## Included pages

- Operations dashboard with a six-week sales trend, open work, current alerts, location inventory, recent activity, and a live financial snapshot.
- Integrated Financials page with Profit & Loss, sales/profit trend, weighted-average inventory valuation, and inventory turnover; linked directly from the Dashboard.
- POS with multi-line items, discount, tax, stock updates, and printable receipt.
- Inventory by item and three locations, barcode scanning/printing, transfers, reason-coded adjustments, backorder/ETA indicators.
- Sales orders with line items and placed, confirmed, fulfilled, closed, and cancelled statuses.
- Returns and exchanges with RMA history, credits, quality-case metrics, inspection/quarantine, restock/scrap disposition, exchanges, and revenue/COGS adjustments.
- Separate Purchase Orders and Supplier Scorecards pages with searchable/status-filtered PO registers, receipt/payment tracking, CSV exports, computed on-time/lead-time/fill/AP measures, editable contacts and terms, sample suppliers, and keep/watch/review ratings. Reorder policy settings and EOQ remain editable.
- Six parent items: Chug Bug, Sip Happens, Gulp Goblin, Sipsqueak, Gulp Guardian, and Sipstick. Sipstick is $15.99 and uses a straw tube plus an inline straw sip sensor; Gulp Guardian uses the plastic lid shell plus cap sensor/LED. Cartons are not in the BOM.
- Production orders that issue BOM components, receive completed parent units at rolled-up BOM cost, and report yield, scrap, and cycle time.
- MRP and manager reports, including sales history, top products, replenishment, location stock, suppliers, capacity, and backlog.
- A customer pickup demo and a Supabase authentication/realtime connection form.

## Connect Supabase for shared logins and live updates

1. Create a Supabase project and run `supabase/schema.sql` in its SQL Editor.
2. In **Database & logins**, enter the project URL and anon/public key. Never use a service-role key in the browser.
3. Create team accounts from **Database & logins**. New sign-ups default to customer-only access.
4. In Supabase SQL Editor, promote approved team accounts (replace the email):
   ```sql
   insert into public.profiles (user_id, display_name, role)
   select id, split_part(email, '@', 1), 'staff'
   from auth.users where email = 'teammate@example.com'
   on conflict (user_id) do update set role = 'staff';
   ```
5. Team users sign in to share the `erp_state` snapshot through Supabase Realtime. The pickup portal's demo login does not grant team access.
6. Configure email confirmation and access policies to match the class demo before sharing it.

The browser app currently syncs its complete state as one JSON snapshot row so the team can get a working multi-user preview quickly. The schema also includes relational tables for a later migration. For production use, replace whole-snapshot writes with validated transactional RPCs, role-aware policies, and normalized table operations.

## Sample data

Names, stock, costs, supplier contacts, return authorizations, six months of generated sales history, work orders, and PO history are editable classroom examples. Supplier names and the returns/PO dashboards incorporate the structure shown in the provided reference screenshots. They are not vendor quotes or production specifications. The Sipstick and Gulp Guardian electronics are modeled as inventory components; app/Tamagotchi behavior and actual sip sensing hardware are outside this ERP preview.
