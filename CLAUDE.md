# Backend — see full project context in the sibling repo

This is the Express/Mongoose API for 9jaTradiesPages. The full project handoff doc — architecture, what's been built, known bugs, and the current Phase 3 plan — lives at:

`C:\Users\HP\Desktop\Services\serviceprovider\CLAUDE.md`

Read that first. Short version: this backend talks to production MongoDB (no separate dev DB — use disposable test accounts + cleanup scripts, see the pattern described in the doc above). `PAYSTACK_SECRET_KEY`/`PAYSTACK_PUBLIC_KEY` test keys are already in `.env`. `JWT_SECRET` is required at boot (no fallback). Real-time events go through `socket.js`'s `emitNewMessage()` / `services/notificationService.js`'s `notifyUser()` — never write directly to `Notification` or emit sockets ad hoc elsewhere.
