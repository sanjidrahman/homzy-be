# Home Baker Marketplace - Backend API

A complete backend API for a Home Baker Marketplace application where users can purchase baked goods from home bakers. Built for college project targeting the Indian market with three user roles: User, Baker, and Admin.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (baker_db)
- **Database Access**: Raw SQL queries using pg library (NO ORM)
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **UUID Generation**: uuid package
- **File Upload**: Multer + Cloudinary SDK
- **Email Service**: Nodemailer (for OTP verification)
- **Payment Gateway**: Razorpay (test mode)

## Prerequisites

1. **Node.js** (v22)
2. **PostgreSQL**
3. **Cloudinary Account** (for image storage)
4. **Gmail Account** (for email verification)
5. **Razorpay Account** (for payments - test mode)

## Installation

### 1. Clone the repository

```bash
cd baker-proj-be
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up PostgreSQL database

Create a database named `baker_db` in PostgreSQL:

```sql
CREATE DATABASE baker_db;
```

Then run the SQL schema provided in the project documentation to create all tables.

### 4. Create environment variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Update the following values:
- Database credentials (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
- JWT secret (JWT_SECRET) - use a strong random string
- Cloudinary credentials (from your Cloudinary dashboard)
- Email credentials (use Gmail app password, not regular password)
- Razorpay test keys (from Razorpay dashboard - Settings → API Keys)

### 5. Start the server

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will run on `http://localhost:3001`

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection
│   │   ├── cloudinary.js        # Cloudinary setup
│   │   └── stripe.js            # Razorpay setup
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   ├── roleCheck.js         # Role-based access control
│   │   └── upload.js            # Multer configuration
│   ├── utils/
│   │   ├── emailService.js      # Nodemailer OTP sender
│   │   ├── generateOTP.js       # OTP generation logic
│   │   └── cloudinaryUpload.js  # Cloudinary upload helper
│   ├── routes/
│   │   ├── auth.routes.js       # Authentication routes
│   │   ├── baker.routes.js      # Baker-specific routes
│   │   ├── user.routes.js       # User-specific routes
│   │   ├── admin.routes.js      # Admin-specific routes
│   │   ├── category.routes.js   # Category routes
│   │   └── payment.routes.js    # Payment routes (Razorpay)
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── baker.controller.js
│   │   ├── user.controller.js
│   │   ├── admin.controller.js
│   │   ├── category.controller.js
│   │   └── payment.controller.js
│   └── app.js                   # Express app setup
├── uploads/                     # Temporary upload folder (multer)
├── .env
├── .gitignore
├── package.json
└── server.js                    # Entry point
```

## API Documentation

### Base URL
```
http://localhost:3001/api
```

---

## Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/signup` | User registration | No |
| POST | `/auth/login` | Login (all roles) | No |
| GET | `/auth/profile` | Get current user profile | Yes |
| PUT | `/auth/profile` | Update user profile | Yes |

### User Signup
```http
POST /auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "9876543210",
  "address": {
    "street": "123 Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }
}
```

### Login (All Roles)
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Get Profile
```http
GET /auth/profile
Authorization: Bearer <jwt_token>
```

### Update Profile
```http
PUT /auth/profile
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "John Updated",
  "phone": "9876543299"
}
```

---

## Category Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/categories` | Get all categories | No |
| POST | `/categories` | Create category (admin only) | Admin |

### Get All Categories
```http
GET /categories
```

---

## Baker Registration Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/baker/signup/step1` | Send OTP to email | No |
| POST | `/baker/verify-otp` | Verify email OTP | No |
| POST | `/baker/profile/complete` | Complete baker profile | Baker |
| GET | `/baker/verification-status` | Check verification status | Baker |

### Step 1: Send OTP
```http
POST /baker/signup/step1
Content-Type: application/json

{
  "name": "Jane Baker",
  "email": "jane@example.com",
  "password": "password123",
  "phone": "9876543211"
}
```

### Verify OTP
```http
POST /baker/verify-otp
Content-Type: application/json

{
  "email": "jane@example.com",
  "otp": "123456"
}
```

### Step 2: Complete Profile
```http
POST /baker/profile/complete
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

Form Fields:
- bakery_name: "Sweet Treats Bakery"
- city: "Mumbai"
- state: "Maharashtra"
- pincode: "400001"
- id_proof_type: "aadhar"
- id_proof_number: "1234-5678-9012"
- fssai_number: "1234567890"
- food_safety_declaration: true
- payment_method: "upi"
- upi_id: "jane@upi"
- item_types: ["cakes", "cookies", "pastries"]
- is_veg: true
- is_nonveg: false
- has_eggless_option: true
- terms_accepted: true

Files:
- profile_photo: <file>
- id_proof_document: <file>
```

### Check Verification Status
```http
GET /baker/verification-status
Authorization: Bearer <jwt_token>
```

---

## User (Customer) Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/user/products` | Get all products (with filters) | No |
| GET | `/user/products/:id` | Get single product details | No |
| GET | `/user/bakers` | Get all approved bakers | No |
| GET | `/user/products/:id/reviews` | Get product reviews | No |
| POST | `/user/reviews` | Add/update review (max 3 per user) | User |
| DELETE | `/user/reviews/:id` | Delete review | User |
| POST | `/user/orders` | Place order | User |
| GET | `/user/orders` | Get user order history | User |
| GET | `/user/orders/:id` | Get single order details | User |

### Get All Products
```http
GET /user/products?category=<uuid>&baker_id=<uuid>&search=<keyword>
```

### Get Single Product
```http
GET /user/products/:id
```

### Get All Bakers
```http
GET /user/bakers
```

### Get Product Reviews
```http
GET /user/products/:id/reviews
```

### Add/Update Review
```http
POST /user/reviews
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "product_id": "uuid",
  "rating": 5,
  "comment": "Amazing cake!"
}
```
**Note:** Each user can add up to 3 reviews. Re-submitting a review for the same product will update it.

### Delete Review
```http
DELETE /user/reviews/:id
Authorization: Bearer <jwt_token>
```

### Place Order
```http
POST /user/orders
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "price": 150.00,
      "baker_id": "uuid"
    }
  ],
  "total_amount": 300.00,
  "delivery_address": {
    "street": "123 Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  },
  "payment_id": "razorpay_payment_id"
}
```

### Get User Orders
```http
GET /user/orders
Authorization: Bearer <jwt_token>
```

### Get Single Order
```http
GET /user/orders/:id
Authorization: Bearer <jwt_token>
```

---

## Baker Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/baker/products` | Get baker's own products | Baker |
| POST | `/baker/products` | Create new product | Baker |
| PUT | `/baker/products/:id` | Update product | Baker |
| DELETE | `/baker/products/:id` | Delete product | Baker |
| GET | `/baker/orders` | Get baker's orders | Baker |
| PATCH | `/baker/orders/:id/status` | Update order status | Baker |
| GET | `/baker/dashboard` | Get baker dashboard stats | Baker |

### Create Product
```http
POST /baker/products
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

{
  "name": "Chocolate Cake",
  "description": "Delicious chocolate cake",
  "price": 500.00,
  "category_id": "uuid"
}

File: image
```

### Get Baker's Products
```http
GET /baker/products
Authorization: Bearer <jwt_token>
```

### Update Product
```http
PUT /baker/products/:id
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

### Delete Product
```http
DELETE /baker/products/:id
Authorization: Bearer <jwt_token>
```

### Get Baker Orders
```http
GET /baker/orders
Authorization: Bearer <jwt_token>
```

### Update Order Status
```http
PATCH /baker/orders/:id/status
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "status": "accepted"
}
```
**Status values:** `accepted`, `preparing`, `ready`, `completed`

### Baker Dashboard
```http
GET /baker/dashboard
Authorization: Bearer <jwt_token>
```

---

## Admin Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/bakers/pending` | Get pending baker verifications | Admin |
| GET | `/admin/bakers/:id` | Get baker details | Admin |
| PATCH | `/admin/bakers/:id/approve` | Approve baker | Admin |
| PATCH | `/admin/bakers/:id/reject` | Reject baker | Admin |
| GET | `/admin/bakers` | Get all bakers (with filters) | Admin |
| GET | `/admin/users` | Get all users | Admin |
| PATCH | `/admin/users/:id/status` | Block/unblock user | Admin |
| GET | `/admin/products` | Get all products | Admin |
| DELETE | `/admin/products/:id` | Delete any product | Admin |
| GET | `/admin/orders` | Get all orders | Admin |
| GET | `/admin/dashboard` | Get admin dashboard stats | Admin |

### Get Pending Verifications
```http
GET /admin/bakers/pending
Authorization: Bearer <jwt_token>
```

### Get Baker Details
```http
GET /admin/bakers/:id
Authorization: Bearer <jwt_token>
```

### Approve Baker
```http
PATCH /admin/bakers/:id/approve
Authorization: Bearer <jwt_token>
```

### Reject Baker
```http
PATCH /admin/bakers/:id/reject
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "rejection_reason": "Documents unclear"
}
```

### Get All Bakers
```http
GET /admin/bakers?status=approved
Authorization: Bearer <jwt_token>
```

### Get All Users
```http
GET /admin/users
Authorization: Bearer <jwt_token>
```

### Block/Unblock User
```http
PATCH /admin/users/:id/status
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "status": "blocked"
}
```
**Status values:** `active`, `blocked`

### Get All Products
```http
GET /admin/products
Authorization: Bearer <jwt_token>
```

### Delete Product
```http
DELETE /admin/products/:id
Authorization: Bearer <jwt_token>
```

### Get All Orders
```http
GET /admin/orders
Authorization: Bearer <jwt_token>
```

### Admin Dashboard
```http
GET /admin/dashboard
Authorization: Bearer <jwt_token>
```

---

## Payment Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/payment/create-intent` | Create Razorpay payment | User |
| POST | `/payment/confirm` | Confirm payment | User |

### Create Payment Intent
```http
POST /payment/create-intent
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "amount": 500.00
}
```

### Confirm Payment
```http
POST /payment/confirm
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "payment_intent_id": "pi_xxx",
  "order_id": "uuid"
}
```

---

## Error Handling

All errors return JSON in the following format:

```json
{
  "error": "Error message here"
}
```

Common HTTP status codes:
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Database Schema

The application uses the following tables:
- `users` - All users (user/baker/admin roles)
- `baker_profiles` - Baker verification details
- `otp_verifications` - Email OTP storage
- `addresses` - User delivery addresses
- `categories` - Product categories
- `products` - Bakery products
- `orders` - Order records
- `order_items` - Order line items
- `reviews` - Product reviews

All tables use UUID as primary keys.

---

## Testing with Postman

1. Import the API endpoints into Postman
2. Set up environment variables for base URL and tokens
3. Test endpoints in order:
   - Signup/Login
   - Create resources (products, orders)
   - Update/Read operations
   - Admin operations

---

## Security Features

- Password hashing with bcrypt (10 rounds)
- JWT authentication for protected routes
- Role-based access control (user, baker, admin)
- Input validation on all endpoints
- File upload restrictions (images only, 5MB max)
- CORS protection
- OTP-based email verification for bakers

---

## Development

### Running in development mode
```bash
npm run dev
```

### Database migrations
Before running the application, ensure PostgreSQL is running and the database is created with all required tables.

---

## License

ISC

## Author

College Project - Home Baker Marketplace
