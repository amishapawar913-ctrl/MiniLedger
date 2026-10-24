# MiniLedger

A small app to track money lent to friends.

- **Backend:** Node.js, TypeScript, Express, PostgreSQL
- **App:** React Native (Expo, TypeScript)

```
miniledger/
├── backend/             # REST API (Express, pg, zod, JWT, multer)
├── mobile/              # Expo React Native app
└── docker-compose.yml   # Optional: Postgres via Docker
```

## Features

- Phone number login with a mock OTP (the OTP is printed in the server console)
- Add a loan entry (friend name, amount, due date) and mark it as repaid
- Summary card: total lent, total repaid, outstanding and overdue amount
- Entries list with overdue entries highlighted in red
- Bonus: receipt photo upload, input validation (client and server), unit tests

## Requirements

- Node.js 18 or newer
- PostgreSQL (or Docker)
- Expo Go app on your phone (or an Android emulator)

## 1. Run the backend

1. Create a PostgreSQL database named `miniledger`.
   - With Docker: `docker compose up -d` (starts Postgres with user, password and database all set to `miniledger`).
   - Without Docker: install PostgreSQL, then in psql run `CREATE DATABASE miniledger;`

2. Set up and start the server:

```bash
cd backend
cp .env.example .env      # Windows PowerShell: copy .env.example .env
npm install
npm run dev
```

3. Open `backend/.env` and set `DATABASE_URL` to match your database:

```
DATABASE_URL=postgres://<user>:<password>@localhost:5432/miniledger
JWT_SECRET=change-me
PORT=4000
```

(With the Docker setup, the default value in `.env.example` already works.)

The server starts at `http://localhost:4000` and creates its tables automatically. You should see `MiniLedger API on :4000`.

Run the tests with:

```bash
npm test
```

## 2. Run the app

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go. Your phone and computer must be on the same Wi-Fi network.

**Tell the app where the backend is.** Create a file `mobile/.env` with your computer's local IP address (find it with `ipconfig` on Windows or `ifconfig` on Mac/Linux):

```
EXPO_PUBLIC_API_URL=http://192.168.1.4:4000
```

Restart Expo with `npx expo start -c` after changing this file.

- Android emulator: no `.env` needed (it uses `http://10.0.2.2:4000`).
- iOS simulator: use `EXPO_PUBLIC_API_URL=http://localhost:4000`.
- If the phone cannot reach the server, allow Node.js through the firewall and check that `http://<your-ip>:4000/health` opens in the phone's browser.

## 3. Login flow

1. Enter a phone number (10 to 13 digits) and tap **Send OTP**.
2. Look at the backend terminal for a line like `[MOCK OTP] 9876543210 -> 482915`.
3. Enter the OTP and tap **Verify & Login**.

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/request-otp` | none | Body `{phone}`. Generates an OTP and logs it |
| POST | `/auth/verify-otp` | none | Body `{phone, otp}`. Returns `{token}` (JWT, valid 7 days) |
| GET | `/loans` | Bearer token | List my entries |
| POST | `/loans` | Bearer token | Multipart form: `friend_name`, `amount`, `due_date` (YYYY-MM-DD), optional `receipt` image |
| PATCH | `/loans/:id/repaid` | Bearer token | Mark an entry as repaid |
| GET | `/summary` | Bearer token | `{total_lent, total_repaid, outstanding, overdue_amount}` |
| GET | `/health` | none | Health check |

## Design notes

- An entry is **overdue** if it is not repaid and its due date is before today. An entry due today is not overdue.
- OTPs are 6 digits, expire after 5 minutes and can be used only once. A user is created on first successful login.
- Every query is filtered by the logged-in user's id, so users only see their own entries.
- Inputs are validated with zod on the server and checked again in the app. Amounts are stored as `NUMERIC(12,2)`.
- Receipt photos are saved to `backend/uploads` and served from `/uploads/...`. In production I would use object storage such as S3.
- The summary calculation is a pure function (`backend/src/summary.ts`), which makes it easy to unit test.