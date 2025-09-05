# E-commerce Backend (Express + MongoDB)

Role-based backend for Admin and Buyer.
- Auth (register/login) with JWT
- Products (CRUD)
- Cart (per user)
- Orders
- Simple payments placeholder (integration ready)

## Quick Start

```bash
cp .env.example .env
# edit .env with your Mongo URI and JWT secret

npm install
npm run dev
```

Default server: `http://localhost:$PORT` (5000).

### API Base
- Public: `/api/auth/*`, `/api/products`
- Buyer: `/api/cart/*`, `/api/orders/*` (requires token)
- Admin: `/api/admin/*` (requires token with role=admin)

### Deploy on Render
1. Create a **Web Service** → Connect this repo.
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Add env vars: `PORT`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`
5. Enable autoscaling if needed.
