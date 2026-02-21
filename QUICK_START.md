# Quick Start Guide

Get your Dormitory Management System up and running in 15 minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] LINE account
- [ ] MongoDB installed or Atlas account
- [ ] Code editor (VS Code recommended)

## Step 1: Install Dependencies (2 minutes)

```bash
cd z:\next\rooms
npm install
```

## Step 2: Configure LINE LIFF (5 minutes)

### 2.1 Create LINE Login Channel

1. Visit [LINE Developers Console](https://developers.line.biz/)
2. Login with your LINE account
3. Create new Provider (or select existing)
4. Click "Create a LINE Login channel"
5. Fill required fields:
   - Channel name: `Dorm Manager`
   - Channel description: `Family Dormitory System`
   - App types: ✅ Web app
6. Click "Create"

### 2.2 Add LIFF App

1. In your LINE Login channel → LIFF tab
2. Click "Add"
3. Configure:
   - LIFF app name: `Dorm System`
   - Size: **Full**
   - Endpoint URL: `http://localhost:3000`
   - Scope: ✅ profile, ✅ openid
4. Click "Add"
5. **Copy the LIFF ID** (format: `1234567890-abcdefgh`)

### 2.3 Get Channel Credentials

1. Go to "Basic settings" tab
2. Copy **Channel secret**
3. Go to "Messaging API" tab (optional for notifications)
4. Issue **Channel access token**

## Step 3: Setup MongoDB (3 minutes)

### Option A: Local MongoDB

```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Ubuntu/Debian
sudo apt install mongodb
sudo systemctl start mongodb

# Windows
# Download from https://www.mongodb.com/try/download/community
# Install and start service
```

### Option B: MongoDB Atlas (Cloud)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free cluster (M0)
3. Create database user
4. Whitelist IP: `0.0.0.0/0` (for development)
5. Copy connection string

## Step 4: Environment Configuration (2 minutes)

Create `.env.local`:

```bash
# Copy template
cp .env.local.example .env.local

# Or create manually:
```

**.env.local contents:**

```env
# MongoDB - Use your connection string
MONGODB_URI=mongodb://localhost:27017/dorm-management

# LINE LIFF - Replace with your LIFF ID
NEXT_PUBLIC_LIFF_ID=1234567890-abcdefgh

# LINE API (optional for notifications)
LINE_CHANNEL_ACCESS_TOKEN=your_token_here
LINE_CHANNEL_SECRET=your_secret_here

# PromptPay - Your phone number (10 digits) or Tax ID (13 digits)
NEXT_PUBLIC_PROMPTPAY_ID=0812345678

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 5: Initialize Database (1 minute)

Create `scripts/init-db.js`:

```javascript
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/dorm-management');

// Create sample rooms
const Room = mongoose.model('Room', new mongoose.Schema({
  roomNumber: String,
  floor: Number,
  baseRentPrice: Number,
  status: String,
  waterRate: Number,
  electricityRate: Number,
}));

async function init() {
  // Create 10 sample rooms
  const rooms = [];
  for (let i = 1; i <= 10; i++) {
    rooms.push({
      roomNumber: `10${i}`,
      floor: 1,
      baseRentPrice: 3500,
      status: 'vacant',
      waterRate: 18,
      electricityRate: 8,
    });
  }

  await Room.insertMany(rooms);
  console.log('✅ Created 10 sample rooms');

  mongoose.connection.close();
}

init();
```

Run:
```bash
node scripts/init-db.js
```

## Step 6: Start Development Server (1 minute)

```bash
npm run dev
```

Visit: `http://localhost:3000`

## Step 7: First Login & Get Your User ID (2 minutes)

### 7.1 Access via LINE

**Important**: LIFF apps must be accessed through LINE app for authentication to work.

**Option A: Use ngrok (Recommended for testing)**

1. Install ngrok:
```bash
npm install -g ngrok
```

2. Start ngrok:
```bash
ngrok http 3000
```

3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

4. Update LIFF Endpoint URL in LINE Developers Console to ngrok URL

5. Create a test message in LINE with the URL:
```
https://liff.line.me/YOUR-LIFF-ID
```

6. Open the message in LINE app

**Option B: Deploy to Vercel first** (see DEPLOYMENT.md)

### 7.2 Get Your LINE User ID

1. After logging in, open Browser DevTools (inspect)
2. Go to Console tab
3. Type:
```javascript
console.log(await liff.getProfile())
```
4. Copy the `userId` (starts with `U`)

### 7.3 Set Yourself as Admin

1. Open MongoDB shell or Compass
2. Set your user as admin:
```javascript
use dorm-management

// Find your user (replace with your display name)
db.users.findOne({ displayName: "Your Name" })

// Set role to admin
db.users.updateOne(
  { displayName: "Your Name" },
  { $set: { role: "admin" } }
)
```

3. Refresh LINE app
4. You should now see Admin Dashboard!

## Step 8: Test the System (5 minutes)

### 8.1 Admin Flow

1. ✅ Access `/admin/dashboard`
2. ✅ See Bird's Eye View with vacant rooms (gray)
3. ✅ Click on a room
4. ✅ Generate QR Code for room assignment

### 8.2 Tenant Flow (Use different LINE account)

1. ✅ Scan QR Code with LINE app
2. ✅ Auto-join room
3. ✅ View tenant dashboard
4. ✅ See "No invoice yet" message

### 8.3 Create Test Invoice

Open MongoDB Compass or mongosh:

```javascript
use dorm-management

// Find your test tenant
db.users.findOne({ role: 'tenant' })

// Find the assigned room
db.rooms.findOne({ status: 'occupied' })

// Create test invoice
db.invoices.insertOne({
  roomId: ObjectId("room_id_here"),
  tenantId: ObjectId("tenant_id_here"),
  month: 2,
  year: 2026,
  waterUnits: 10,
  electricityUnits: 100,
  rentAmount: 3500,
  waterAmount: 180,
  electricityAmount: 800,
  totalAmount: 4480,
  paymentStatus: 'pending',
  dueDate: new Date('2026-02-05'),
  createdAt: new Date(),
  updatedAt: new Date()
})
```

### 8.4 Test Payment Flow

1. ✅ Tenant sees invoice in dashboard
2. ✅ Click "Pay Now"
3. ✅ See PromptPay QR Code
4. ✅ Upload test payment slip
5. ✅ Admin dashboard shows room as yellow (pending)

## Troubleshooting

### LIFF Init Failed

**Error**: "LIFF initialization failed"

**Solutions**:
- ✅ Check LIFF ID is correct in `.env.local`
- ✅ Verify endpoint URL matches (use ngrok for local dev)
- ✅ Must access via LINE app, not regular browser
- ✅ Clear LINE app cache

### Database Connection Error

**Error**: "Failed to connect to MongoDB"

**Solutions**:
- ✅ Check MongoDB is running: `brew services list` (macOS)
- ✅ Verify MONGODB_URI in `.env.local`
- ✅ For Atlas: Check IP whitelist and credentials

### Not Redirecting to Admin Dashboard

**Error**: Redirects to tenant dashboard even though you're admin

**Solutions**:
- ✅ Verify user's `role` is set to `'admin'` in database
- ✅ Check user exists: `db.users.findOne({ lineUserId: "Uxxxx" })`
- ✅ Update role: `db.users.updateOne({ lineUserId: "Uxxxx" }, { $set: { role: "admin" } })`
- ✅ Clear browser/LINE app cache

### QR Code Doesn't Work

**Error**: "Invalid or expired token"

**Solutions**:
- ✅ Tokens expire after 24 hours - generate new one
- ✅ Room must be vacant
- ✅ User must not already have a room assigned

## Next Steps

### Customize Your System

1. **Update room pricing**:
   ```javascript
   db.rooms.updateMany({}, {
     $set: {
       baseRentPrice: 4000,
       waterRate: 20,
       electricityRate: 9
     }
   })
   ```

2. **Change due date** (default: 5th of month):
   ```javascript
   db.systemconfigs.insertOne({
     key: 'dueDay',
     value: 10,
     description: 'Payment due day'
   })
   ```

3. **Add more rooms**: Use MongoDB or create admin UI

### Ready for Production?

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- ✅ Vercel deployment
- ✅ Production MongoDB setup
- ✅ SSL certificate
- ✅ LINE OA integration
- ✅ Payment notifications

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm start               # Start production server

# Database
mongosh                 # MongoDB shell
mongodb-compass         # GUI tool

# Deployment
vercel                  # Deploy to Vercel
vercel --prod          # Deploy to production
```

## Getting Help

### Documentation
- 📖 [README.md](README.md) - Overview
- 🚀 [DEPLOYMENT.md](DEPLOYMENT.md) - Deploy guide
- 💻 [IMPLEMENTATION.md](IMPLEMENTATION.md) - Code details
- 📊 [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Full summary

### Resources
- [LINE LIFF Docs](https://developers.line.biz/en/docs/liff/)
- [Next.js Docs](https://nextjs.org/docs)
- [MongoDB Docs](https://docs.mongodb.com/)

## Success Checklist

After completing Quick Start, you should have:

- ✅ Next.js app running on localhost:3000
- ✅ MongoDB connected and initialized
- ✅ LINE LIFF authentication working
- ✅ Admin dashboard accessible
- ✅ QR code generation working
- ✅ Test room and invoice created
- ✅ Payment flow tested

**Congratulations! Your Dormitory Management System is ready! 🎉**

---

**Time to complete**: ~15 minutes
**Difficulty**: Beginner-friendly
**Support**: Check documentation files for detailed help
