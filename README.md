# Family-run Dormitory Management System

A comprehensive LINE Mini App/LIFF application for managing family-run dormitories with mobile-first design.

## Tech Stack

- **Frontend**: Next.js 15.5.9 (App Router), Tailwind CSS, Shadcn UI
- **Backend**: Next.js API Routes
- **Database**: MongoDB with Mongoose
- **Authentication**: LINE LIFF (userId-based)
- **State Management**: TanStack Query (React Query)
- **Payment**: PromptPay QR Code

## Features

### Admin Features
- Bird's Eye View Dashboard (Color-coded room status)
- Room Management
- QR Code Room Assignment System
- Monthly Invoice Generation
- Payment Tracking & Verification
- Manual Payment Override

### Tenant Features
- Monthly Bill Dashboard
- PromptPay QR Code Payment
- Payment Slip Upload
- Invoice History
- Automatic Room Assignment via QR Code

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file with the following:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/dorm-management

# LINE LIFF Configuration
NEXT_PUBLIC_LIFF_ID=your-liff-id-here
LINE_CHANNEL_ACCESS_TOKEN=your-channel-access-token
LINE_CHANNEL_SECRET=your-channel-secret

# PromptPay Configuration
NEXT_PUBLIC_PROMPTPAY_ID=0123456789

# Admin Configuration
ADMIN_LINE_USERIDS=U1234567890abcdef

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. Set Up LINE LIFF

1. Go to [LINE Developers Console](https://developers.line.biz/)
2. Create a new Provider (or use existing)
3. Create a LINE Login Channel
4. Add a LIFF app with these settings:
   - Size: Full
   - Endpoint URL: `https://your-domain.com`
   - Scopes: `profile`, `openid`
5. Copy the LIFF ID to `.env.local`

### 4. Set Up MongoDB

```bash
# Install MongoDB locally or use MongoDB Atlas
# For local installation:
brew install mongodb-community  # macOS
# or
sudo apt install mongodb  # Ubuntu

# Start MongoDB
brew services start mongodb-community  # macOS
# or
sudo systemctl start mongodb  # Ubuntu
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## Database Schema

### User/Tenant Model
```typescript
{
  lineUserId: string (unique)
  displayName: string
  pictureUrl?: string
  phone?: string
  role: 'admin' | 'tenant'
  roomId?: ObjectId
  contractStartDate?: Date
  contractEndDate?: Date
  isActive: boolean
}
```

### Room Model
```typescript
{
  roomNumber: string (unique)
  floor: number
  baseRentPrice: number
  status: 'vacant' | 'occupied' | 'maintenance'
  tenantId?: ObjectId
  assignmentToken?: string
  tokenExpiresAt?: Date
  waterRate?: number
  electricityRate?: number
}
```

### Invoice Model
```typescript
{
  roomId: ObjectId
  tenantId: ObjectId
  month: number (1-12)
  year: number
  waterUnits: number
  electricityUnits: number
  rentAmount: number
  waterAmount: number
  electricityAmount: number
  totalAmount: number
  paymentStatus: 'pending' | 'paid' | 'overdue'
  dueDate: Date
  paidAt?: Date
  paymentSlipUrl?: string
}
```

## Key Features Implementation

### 1. QR Code Room Assignment

**Admin Flow:**
```typescript
// Generate assignment token for a room
POST /api/rooms/assign
Body: { roomId: string }
Response: { token: string, assignmentUrl: string }
```

The admin can then:
1. Use `qrcode` library to generate QR code from `assignmentUrl`
2. Print and give to tenant
3. Tenant scans with LINE app

**Tenant Flow:**
```typescript
// Tenant scans QR and automatically joins room
POST /api/tenant/join
Headers: { x-line-userid: string }
Body: { token: string }
Response: { success: true, roomNumber: string }
```

### 2. Bird's Eye View Dashboard

Color-coded room status visualization:
- **Green** = Paid
- **Red** = Overdue
- **Yellow** = Pending
- **Gray** = Vacant
- **Orange** = Maintenance
- **Blue** = Occupied (no invoice yet)

### 3. PromptPay QR Code

Generates dynamic PromptPay QR codes with exact amounts:

```typescript
import { getPromptPayQRCodeUrl } from '@/lib/promptpay';

const qrUrl = getPromptPayQRCodeUrl('0812345678', 5000);
// Returns Google Charts API URL with EMVCo-compliant payload
```

### 4. Monthly Invoice Generation

```typescript
import { generateInvoice } from '@/lib/billing';

await generateInvoice({
  roomId: 'room123',
  month: 1,
  year: 2026,
  waterUnits: 10,
  electricityUnits: 150,
  // Automatically calculates amounts based on room rates
});
```

## API Routes

### Authentication
- `POST /api/auth/profile` - Sync LINE profile

### Admin Routes
- `GET /api/admin/dashboard` - Get dashboard data
- `POST /api/rooms/assign` - Generate room assignment token

### Tenant Routes
- `GET /api/tenant/invoice/current` - Get current month invoice
- `GET /api/tenant/invoice/history` - Get invoice history
- `POST /api/tenant/join` - Join room via token
- `POST /api/tenant/payment/upload` - Upload payment slip

## Project Structure

```
src/
├── app/
│   ├── admin/
│   │   └── dashboard/
│   ├── tenant/
│   │   ├── dashboard/
│   │   └── payment/
│   ├── api/
│   │   ├── admin/
│   │   ├── tenant/
│   │   ├── rooms/
│   │   └── auth/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── admin/
│   │   └── BirdsEyeView.tsx
│   ├── tenant/
│   │   ├── Dashboard.tsx
│   │   └── PaymentPage.tsx
│   └── ui/
├── lib/
│   ├── mongodb.ts
│   ├── liff.ts
│   ├── auth.ts
│   ├── billing.ts
│   ├── promptpay.ts
│   ├── room-assignment.ts
│   └── utils.ts
├── models/
│   ├── User.ts
│   ├── Room.ts
│   ├── Invoice.ts
│   └── SystemConfig.ts
└── providers/
    ├── QueryProvider.tsx
    └── LiffProvider.tsx
```

## Color Scheme (Family-Friendly)

- Primary Green: `#16a34a` (Green 600)
- Primary Blue: `#2563eb` (Blue 600)
- Background Gradient: Green 50 to Blue 50
- Soft neutrals with high contrast for readability

## Mobile-First Design

All components are optimized for mobile:
- Touch-friendly buttons (min 44px)
- Responsive grid layouts
- Bottom-safe navigation
- Optimized for LINE in-app browser

## Security Considerations

1. **Authentication**: All API routes require LINE userId in headers
2. **Authorization**: Admin routes check role via `requireAdmin()`
3. **Data Validation**: Mongoose schema validation
4. **Token Expiry**: Room assignment tokens expire in 24 hours

## Future Enhancements

1. **LINE Messaging API Integration**
   - Automatic payment reminders
   - Rich message invoices
   - Payment confirmation notifications

2. **Cloud Storage**
   - Cloudinary/S3 for payment slips
   - Invoice PDF generation

3. **Advanced Features**
   - Expense tracking
   - Maintenance requests
   - Multi-language support
   - Analytics dashboard

## Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

### Docker

```dockerfile
# Dockerfile included in project
docker build -t dorm-app .
docker run -p 3000:3000 dorm-app
```

## License

MIT

## Support

For issues or questions, contact the development team.
