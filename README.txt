WATAGACHI GitHub Pages MRP update

Replace these three files at the repository root on branch New-Main1:
- app.html
- modules.js
- mrp-explosion.js

Keep watagachi-wordmark.png and watagachi-mascot-logo.png at the repository root. This app.html points to those root image files and loads the updated scripts with cache-busting versions. GitHub Pages is configured to publish from the repository root, so the dist copies are not needed for this update.

The MRP queue includes newly placed and confirmed sales orders within the selected planning window. Parent shortages create planned builds; the queue recommends child-component purchase orders. Supplier recommendations choose the lowest quoted price that can arrive by the need date, or flag the fastest option when none can meet it. Action buttons remain available after changing the planning window.
