# InternVault Backend

A Node.js/Express backend for InternVault with authentication, application management, and dynamic pricing features.

## Features

### Authentication

- User registration with email verification
- Login/logout functionality
- Password reset via email
- JWT-based authentication
- Admin role support

### Application Management

- Submit application forms with the following fields:
  - Full name
  - Contact email
  - WhatsApp number
  - Domain
  - Price
  - Currency
- View user's applications
- Admin can view and manage all applications
- Application status tracking (PENDING, APPROVED, REJECTED, IN_PROGRESS, COMPLETED)

### Dynamic Pricing

- Country-based pricing plans using IP geolocation
- Support for multiple currencies (USD, INR, GBP, EUR)
- Duration-based pricing (1-6 months)
- Admin can manage pricing plans
- Fallback to default pricing if country-specific plans not found

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

### Pricing

- `GET /api/pricing/carousel` - Get pricing plans for carousel (public)
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
  id            String   @id @default(cuid())
  fullName      String
  contactEmail  String
  whatsappNumber String
  domain        String
  price         Float
  currency      String
  userId        String
  status        ApplicationStatus @default(PENDING)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### PricingPlan Model

```prisma
model PricingPlan {
  id       String @id @default(cuid())
  duration Int    // in months (1-6)
  price    Float
  currency String
  country  String? // ISO country code
  isActive Boolean @default(true)
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

5. Push database schema:

   ```bash
   npx prisma db push
   ```

6. Seed the database with pricing plans:

   ```bash
   npm run seed
   ```

7. Start the development server:
   ```bash
   npm run dev
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

## Geolocation

The pricing system uses IP geolocation to determine user's country and currency. The system:

1. Extracts client IP from request headers
2. Uses ipapi.co service to get country and currency
3. Returns country-specific pricing plans
4. Falls back to default plans if country-specific plans not found

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
