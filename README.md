# StockLedger — Warehouse Inventory & Movement Control

A static-hostable React + TypeScript + Tailwind CSS warehouse inventory management system designed to run on **GitHub Pages** with real-time **Firebase Firestore** synchronization and **Google Authentication**.

## Features

- **Inventory Dashboard**: Total material SKUs, units on hand, valuation, real-time search, and filters by location, category, and stock status.
- **Atomic Transaction Log**: `IN` (restock), `OUT` (withdrawal), `TRANSFER` (inter-office), and `ADJUST` movements atomically update inventory quantities in Firestore.
- **CSV Exports**: One-click RFC-4180 CSV export for movement history, inventory catalog, and weekly reports.
- **Low-Stock Alerts**: Automatic threshold monitoring with a prioritized replenishment queue.
- **Barcode Scanner Integration**: Supports USB/Bluetooth HID keyboard-wedge scanners and live device camera scanning via `@zxing/browser`.
- **Encrypted Daily Backups**: Client-side `AES-256-GCM` (`PBKDF2-SHA256`) encrypted snapshots with `SHA-256` verification and `.enc.json` download/restore.
- **Automated Weekly Reports**: 7/14/30-day movement velocity charts, top consumed SKUs, and multi-location summaries.
- **Role-Based Access Control (RBAC)**: `Admin`, `Manager`, `Operator`, and `Viewer` permissions enforced in `firestore.rules`.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy on GitHub Pages

1. **Download or export** this project folder and push it to a GitHub repository (`main` branch):
   ```bash
   git init
   git add .
   git commit -m "Initial StockLedger warehouse app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. **Enable GitHub Pages**:
   - Open your GitHub repository → **Settings** → **Pages**.
   - Under **Build and deployment → Source**, select **GitHub Actions**.
   - The included `.github/workflows/deploy-gh-pages.yml` workflow will automatically run `npm run build:gh-pages` and publish `./dist`.
3. **Authorize your GitHub Pages domain in Firebase Authentication**:
   - In the [Firebase Console](https://console.firebase.google.com/) for your project (`mercurial-tensor-6pd8p`), go to **Authentication → Settings → Authorized domains**.
   - Add `<your-username>.github.io` so Google Sign-In popups work on your live GitHub Pages URL.
4. **Update initial admin email (optional)**:
   - Update `rma27660@gmail.com` in `firestore.rules` and `src/lib/warehouseService.ts` if you want a different bootstrapped administrator email, and redeploy rules with `firebase deploy --only firestore:rules`.
