# StudySnaps

StudySnaps is an IPL-style learning arena where students watch 60-second Study Snaps, answer synced questions, assemble 11-player study squads, and compete in live tournaments. The platform includes a Firebase-powered admin console, tournament engine, real-time anti-cheat telemetry, and Razorpay-backed premium subscriptions.

## Tech Stack

- Vanilla HTML + Tailwind CSS (CDN build)
- JavaScript modules (ESM)
- Firebase v10 Modular SDK (Auth, Firestore, Storage, Functions)
- Firebase Cloud Functions (Node 18)
- Razorpay Checkout (₹15/month premium plan)

## Project Structure

```
.
├── index.html                  # Learner experience
├── admin.html                  # Admin control center
├── styles/
│   └── base.css
├── scripts/
│   ├── app.js                  # App bootstrap + UI orchestration
│   ├── admin.js                # Admin console logic
│   ├── auth.js                 # Shared auth helpers
│   ├── firebase.js             # Firebase initialisation (CDN modules)
│   ├── firebaseConfig.js       # Config placeholders & public settings
│   ├── tournamentEngine.js     # Firestore-backed tournament engine
│   ├── payments.js             # Razorpay checkout integration
│   ├── antiCheat.js            # Client anti-cheat instrumentation
│   ├── adManager.js            # Ad rotation for free users
│   └── ui.js                   # Toast + modal utilities
├── utils/
│   └── helpers.js              # Formatting + common helpers
├── assets/
│   ├── favicon.png
│   └── logo.svg
└── functions/
    ├── index.js                # Cloud Functions (orders, premium, webhooks)
    ├── package.json
    └── .env.example
```

## Firebase Setup

1. Create a Firebase project and enable Authentication (Email/Password + Google), Firestore, Storage, and Cloud Functions.
2. Update `scripts/firebaseConfig.js` with your Firebase project credentials:

   ```js
   export const firebaseConfig = {
     apiKey: "YOUR_KEY",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "XXXXXXXXXXXX",
     appId: "1:XXXXXXXXXXXX:web:YYYYYYYYYYYYY",
   };
   export const publicSettings = {
     razorpayKeyId: "rzp_live_XXXX",
     supportEmail: "support@studysnaps.com",
     maintenance: false,
   };
   ```

3. Seed Firestore with required collections (optional but recommended):
   - `roles/{uid}` with `{ admin: true }` for admin accounts.
   - `platformSettings/public` to manage keys from the admin console.

## Cloud Functions

```
cd functions
npm install
```

Configure environment variables (copy `.env.example` → `.env`) and deploy:

```
firebase deploy --only functions
```

The deployed functions include:

- `createRazorpayOrder` – creates ₹15 orders.
- `activatePremium` – verifies payments and updates premium status.
- `broadcastSystemMessage` – admin broadcast utility.
- `runMaintenance` – records maintenance heartbeat.
- `razorpayWebhook` – handles Razorpay webhooks.

## Local Development

Serve the static site with any HTTP server (e.g. `npx serve .`). For local Firebase emulation, run `firebase emulators:start`.

## Deployment

The project is a static frontend suitable for Vercel/Netlify. Ensure build output serves `index.html` and `admin.html` from the project root. Configure environment variables in Firebase/Vercel for Razorpay secrets and Firebase config.

## Premium Flow

1. Free users see rotating ads.
2. `Upgrade ₹15/mo` triggers Razorpay Checkout.
3. Cloud Function verifies payment and marks `premiumStatus/{uid}` active.
4. Premium removes ads, shows premium badge, and unlocks extra perks client-side.

## Anti-cheat Telemetry

Client events (`tabSwitch`, `blur`, `copy`, suspicious key combos) are recorded in Firestore (`antiCheatEvents`) and surfaced in the admin dashboard to flag potential violations.

## Security Notes

- Restrict Firestore security rules to ensure only admins can manage tournaments/content.
- Secure Razorpay secrets using Firebase functions config or environment variables.
- Configure Firebase Authentication email allowlist for admin accounts.

## License

MIT © StudySnaps
