# InternVault Backend

A Node.js/Express backend for InternVault with authentication, application management, payment processing, and dynamic pricing features.

## Features

### Authentication

- User registration with email verification and Google OAuth
- Login/logout functionality
- Password reset via email
- JWT-based authentication
- Admin role support

### Application Management

- Submit application forms with the following fields:
  - Full name
  - Contact email
  - WhatsApp number
  - **Role** (new)
  - Domain
  - Price
  - Currency
- View user's applications
- Admin can view and manage all applications
- Application status tracking (PENDING, APPROVED, REJECTED, IN_PROGRESS, COMPLETED)
- Users can only have one active (PENDING or IN_PROGRESS) application at a time.

### Payment Processing

- Integrated with **Stripe** and **PayPal** for application payments.
- **Google Pay** is supported through the Stripe integration.
- Atomic payment transactions: Application status is updated to `IN_PROGRESS` only after a successful payment.
- Webhooks for handling asynchronous payment confirmations from Stripe and PayPal.

### Dynamic Pricing

- Country-based pricing plans using IP geolocation.
- Support for multiple currencies (USD, INR, GBP, EUR).
- Duration-based pricing (1-12 months).
- Admin can manage pricing plans.
- Fallback to default pricing if country-specific plans are not found.
- Carousel endpoint can be tested with a manual country override (e.g., `/api/pricing/carousel?country=IN`).

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `GET /api/auth/verify` - Verify email
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `DELETE /api/auth/delete-account` - Delete user account

### Applications

- `POST /api/applications/submit` - Submit application form (authenticated)
- `GET /api/applications/my-applications` - Get user's applications (authenticated)
- `GET /api/applications/my-applications/:id` - Get specific application (authenticated)
- `GET /api/applications/all` - Get all applications (admin)
- `PATCH /api/applications/:id/status` - Update application status (admin)

### Payment

- `POST /api/applications/:id/pay/stripe` - Initiate Stripe payment for an application (authenticated)
- `POST /api/applications/:id/pay/paypal` - Initiate PayPal payment for an application (authenticated)

### Webhooks (for payment gateways)

- `POST /webhook/stripe` - Handles Stripe payment events
- `POST /webhook/paypal` - Handles PayPal payment events

### Pricing

- `GET /api/pricing/carousel` - Get pricing plans for carousel (public). Supports `?country=XX` override.
- `POST /api/pricing` - Create pricing plan (admin)
- `GET /api/pricing/all` - Get all pricing plans (admin)
- `PATCH /api/pricing/:id` - Update pricing plan (admin)
- `DELETE /api/pricing/:id` - Delete pricing plan (admin)

## Database Schema

### User Model

```prisma
model User {
  id                String   @id
  name              String
  email             String   @unique
  password          String
  isEmailVerified   Boolean  @default(false)
  emailToken        String?
  emailTokenExpiry  DateTime?
  resetToken        String?
  resetTokenExpiry  DateTime?
  isAdmin           Boolean  @default(false)
  currentStreak     Int      @default(0)
  maxStreak         Int      @default(0)
  lastActiveAt      DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  applications      Application[]
}
```

### Application Model

```prisma
model Application {
  id             String            @id @default(cuid())
  fullName       String
  contactEmail   String
  whatsappNumber String
  role           String
  domain         String
  price          Float
  currency       String
  userId         String
  status         ApplicationStatus @default(PENDING)
  isPaid         Boolean           @default(false)
  paymentId      String?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  user           User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  payment        Payment?
}
```

### Payment Model

```prisma
model Payment {
  id               String         @id @default(cuid())
  applicationId    String         @unique
  amount           Float
  currency         String
  gateway          PaymentGateway
  gatewayPaymentId String?
  status           PaymentStatus  @default(PENDING)
  metadata         Json?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  application      Application    @relation(fields: [applicationId], references: [id], onDelete: Cascade)
}
```

### PricingPlan Model

```prisma
model PricingPlan {
  id        String   @id @default(cuid())
  duration  Int
  price     Float
  currency  String
  country   String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# JWT
JWT_SECRET="your-jwt-secret"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# URLs
BACKEND_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"

# Server
PORT=5000

# Geolocation API
IPAPI_KEY="your_ipapi.com_access_key"

# Stripe
STRIPE_SECRET_KEY="your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="your_stripe_webhook_secret"

# PayPal
PAYPAL_CLIENT_ID="your_paypal_client_id"
PAYPAL_CLIENT_SECRET="your_paypal_client_secret"
# PAYPAL_API_BASE="https://api-m.sandbox.paypal.com" # (optional, defaults to sandbox)
```

## Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables in `.env`

4. Generate Prisma client:

   ```bash
   npx prisma generate
   ```

5. Run database migrations:

   ```bash
   npx prisma migrate dev
   ```

6. Seed the database with pricing plans:

   ```bash
   npx prisma db seed
   ```

7. Start the development server:
   ```bash
   pnpm dev
   ```

## Geolocation

The pricing system uses IP geolocation to determine the user's country and currency.
It uses the free [ip-api.com](http://ip-api.com/) service, which does not require an API key. For local testing, you can simulate requests from different countries by adding the `X-Forwarded-For` header or using the `?country=XX` query parameter on the carousel endpoint.

```
# Example: Test carousel for India
curl "http://localhost:5000/api/pricing/carousel?country=IN"

# Example: Simulate a request from a UK IP
curl -H "X-Forwarded-For: 212.102.33.80" "http://localhost:5000/api/pricing/carousel"
```

## Usage Examples

### Submit Application Form

```javascript
// After user login, submit application
const response = await fetch("/api/applications/submit", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    fullName: "John Doe",
    contactEmail: "john@example.com",
    whatsappNumber: "+1234567890",
    domain: "web-development",
    price: 1500,
    currency: "USD",
  }),
});
```

### Get Pricing Plans for Carousel

```javascript
// Get country-specific pricing plans
const response = await fetch("/api/pricing/carousel");
const data = await response.json();

// Response includes:
// {
//   pricingPlans: [
//     { id: "...", duration: 1, price: 99, currency: "USD", country: "US" },
//     { id: "...", duration: 2, price: 189, currency: "USD", country: "US" },
//     // ... more plans
//   ],
//   userCountry: "US",
//   userCurrency: "USD"
// }
```

### Admin: Create Pricing Plan

```javascript
const response = await fetch("/api/pricing", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  },
  body: JSON.stringify({
    duration: 3,
    price: 269,
    currency: "USD",
    country: "US",
    isActive: true,
  }),
});
```

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Email verification for new accounts
- Admin role-based access control
- Input validation with Zod schemas
- CORS enabled for frontend integration

## Error Handling

All endpoints return consistent error responses:

```javascript
{
  "error": "Error message",
  "errors": {
    "fieldName": ["Validation error message"]
  }
}
```

## Development

- TypeScript for type safety
- Prisma for database ORM
- Express.js for API framework
- Zod for schema validation
- Nodemailer for email functionality
