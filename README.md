# Aangan

Home-services marketplace for Jaipur, built so the next city is a row in the database rather than a new app. Customers request a visit. Nearby verified professionals are offered the job. The first one to accept gets it. Standard work has a fixed city price. Complex work is quoted before anyone starts. The customer pays after the work is finished.

## Platforms

| App | Path | Stack |
| --- | --- | --- |
| API | `apps/api` | NestJS, Prisma, PostgreSQL/PostGIS, Socket.IO |
| Admin | `apps/admin` | Next.js |
| Customer | `apps/customer` | Expo / React Native |
| Provider | `apps/provider` | Expo / React Native |

Shared money formatting lives in `packages/contracts`.

## Run it

Postgres needs the PostGIS image. From the repo root:

```powershell
docker compose up -d db
npm install
npm run db:setup
npm run dev:api
```

In a second terminal:

```powershell
npm run dev:admin
```

API: http://localhost:4000/v1  
Docs: http://localhost:4000/docs  
Admin: http://localhost:3000

Docker is the normal way to run Postgres. On a machine without it, the gitignored `.local` folder can hold a portable PostgreSQL 16 + PostGIS 3.7 cluster. Start it with:

```powershell
.\.local\pgsql\bin\pg_ctl.exe -D .\.local\data -l .\.local\postgres.log start
```

Mobile apps are not part of the npm workspaces (Expo and hoisted React conflict). Install each one, then let Expo align native versions:

```powershell
cd apps\customer
npm install
npx expo install --fix
npx expo start
```

Repeat in `apps\provider`. On a physical phone, set the server field on the welcome screen to your computer's LAN address, for example `http://192.168.1.10:4000/v1`. Android emulator uses `http://10.0.2.2:4000/v1`.

## Demo accounts

Dev OTP is `123456` while `ALLOW_DEV_OTP=true`. That flag is refused in production.

| Role | Phone | Name |
| --- | --- | --- |
| Admin | 9000000001 | Aangan Ops |
| Customer | 9000000002 | Meera Sharma |
| Electrician | 9000000011 | Raju Verma, C-Scheme |
| Plumber | 9000000012 | Imran Khan, Vaishali Nagar |
| Water fitting | 9000000013 | Suresh Yadav, Mansarovar |
| RO | 9000000014 | Priya Joshi, Raja Park |
| Electrician and plumber | 9000000015 | Anita Sharma, Jagatpura |

Seeded pros are verified, cover 18 km from their Jaipur base, and are marked online at seed time. Instant matching still requires a location ping from the last 20 minutes, so open the provider app and go online before an instant request. Scheduled visits use that registered base and the weekly hours (8:00–20:00 Asia/Kolkata). Meera already has a Malviya Nagar address and a few paid visits so reports and earnings are not empty.

## Booking

1. Customer describes the issue, adds photos, and chooses instant or a Jaipur time slot.
2. PostGIS (`ST_DWithin` on the live point) finds approved pros who have the skill, cover the city, are inside their radius, and are free.
3. Instant jobs also require the pro to be online with a location newer than 20 minutes. Scheduled jobs use the registered base and weekly hours in `Asia/Kolkata`.
4. Each match gets a push and a `job:offer` socket event. `UPDATE ... WHERE status = SEARCHING` makes acceptance atomic. Everyone else receives `job:closed`.
5. Fixed prices lock at acceptance. Quotation jobs stay with that pro until the customer approves a line-item quote.
6. The pro marks on the way, started, then finished. The customer pays. Commission is taken from the price, not added on top. GST is the included 18% of that commission.
7. A review updates the pro's average. Admin can refund a captured payment, which debits the earning even if it pushes the balance negative.

Instant search closes after 3 minutes. Scheduled search stays open for 30 minutes. A pro can release a job before travelling. It is offered again to everyone who has not already seen it.

## Money

Amounts are integer paise. Razorpay orders, Checkout, signature verification, and webhooks are implemented. `PAYMENTS_MODE=mock` confirms payment inside the app so the flow runs without keys. Set `razorpay` plus the key, secret, and webhook secret to take real payments. Payouts are an ops ledger: queue an amount, transfer it, then mark it paid with the UTR. RazorpayX can replace that manual step without changing the ledger.

## Security

- OTP is hashed, expires in 5 minutes, locks after 5 attempts, and is rate limited. Admin codes are only sent to existing admin numbers.
- Access tokens last 15 minutes. Refresh tokens rotate, and reuse revokes the user's sessions.
- Bank account numbers are AES-256-GCM. Customers never see them. Revealing one in admin writes an audit log.
- Booking photos must be files this API just stored. KYC files are not on the public upload path.
- Production boot refuses dev OTP and a console SMS provider.

## Expansion

Add a city in admin with a centre and a service radius. Price each service for that city, including the commission in basis points. Pros register a base inside the city. `GET /v1/geo/resolve` only returns a city when the pin is inside an active radius.

Optional production pieces, all read from the environment and idle when unset:

- `REDIS_URL` turns on the Socket.IO Redis adapter.
- `SMS_PROVIDER=msg91` sends OTP through MSG91.
- Firebase service-account fields send FCM. Expo push tokens are delivered through Expo's push service.
- `GOOGLE_MAPS_API_KEY` reverse-geocodes the customer's area. Navigation always opens Google Maps directions.

Copy `apps/api/.env.example` before changing secrets. The checked-in local `.env` is only for this machine and is gitignored.
