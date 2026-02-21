# Deployment Guide

## Prerequisites

1. MongoDB Database (Atlas or self-hosted)
2. LINE Developers Account
3. Domain name with SSL certificate
4. Hosting platform (Vercel, Railway, or VPS)

## Step 1: LINE LIFF Setup

### 1.1 Create LINE Login Channel

1. Go to [LINE Developers Console](https://developers.line.biz/)
2. Create a new Provider or select existing
3. Click "Create a LINE Login channel"
4. Fill in channel details:
   - **Channel name**: Your Dorm Name
   - **Channel description**: Dormitory Management System
   - **App types**: Web app
   - **Email address**: Your contact email

### 1.2 Add LIFF App

1. In your LINE Login channel, go to "LIFF" tab
2. Click "Add" to create a new LIFF app
3. Configure LIFF settings:
   - **LIFF app name**: Dormitory System
   - **Size**: Full
   - **Endpoint URL**: `https://your-domain.com`
   - **Scope**:
     - ✅ profile
     - ✅ openid
   - **Bot link feature**: Optional (ON if you have LINE OA)
   - **Scan QR**: Optional
   - **Module Mode**: OFF

4. Click "Add" and copy the **LIFF ID** (format: `1234567890-abcdefgh`)

### 1.3 Get Channel Credentials

1. Go to "Basic settings" tab
2. Copy **Channel ID**
3. Issue and copy **Channel secret**
4. Go to "Messaging API" tab (if using notifications)
5. Issue and copy **Channel access token**

## Step 2: MongoDB Setup

### Option A: MongoDB Atlas (Recommended for Production)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user:
   - Username: `dormadmin`
   - Password: Generate strong password
4. Whitelist your IP or use `0.0.0.0/0` for development
5. Get connection string:
   ```
   mongodb+srv://dormadmin:<password>@cluster0.xxxxx.mongodb.net/dorm-management?retryWrites=true&w=majority
   ```

### Option B: Self-hosted MongoDB

```bash
# Ubuntu/Debian
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Connection string
mongodb://localhost:27017/dorm-management
```

## Step 3: Environment Configuration

Create `.env.local` (for local) or add environment variables to your hosting platform:

```env
# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dorm-management

# LINE LIFF
NEXT_PUBLIC_LIFF_ID=1234567890-abcdefgh
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
LINE_CHANNEL_SECRET=your_channel_secret

# PromptPay (Your phone or Tax ID)
NEXT_PUBLIC_PROMPTPAY_ID=0812345678

# App URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Step 4: Deployment Options

### Option 1: Vercel (Easiest - Recommended)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow prompts:
   - Link to existing project or create new
   - Configure environment variables in Vercel dashboard
   - Settings → Environment Variables

4. Add environment variables in Vercel:
   - Go to your project → Settings → Environment Variables
   - Add all variables from `.env.local`

5. Redeploy:
```bash
vercel --prod
```

6. Update LIFF Endpoint URL:
   - Go to LINE Developers Console
   - Update LIFF Endpoint URL to your Vercel domain
   - Example: `https://your-project.vercel.app`

### Option 2: Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login:
```bash
railway login
```

3. Initialize:
```bash
railway init
```

4. Add environment variables:
```bash
railway variables set MONGODB_URI="your_connection_string"
railway variables set NEXT_PUBLIC_LIFF_ID="your_liff_id"
# ... add all variables
```

5. Deploy:
```bash
railway up
```

### Option 3: VPS (Ubuntu/Debian)

1. SSH into your server:
```bash
ssh user@your-server-ip
```

2. Install Node.js 18+:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. Install PM2:
```bash
sudo npm install -g pm2
```

4. Clone repository:
```bash
git clone your-repo-url
cd dorm-management
```

5. Install dependencies:
```bash
npm install
```

6. Create `.env.local` with your variables

7. Build:
```bash
npm run build
```

8. Start with PM2:
```bash
pm2 start npm --name "dorm-app" -- start
pm2 save
pm2 startup
```

9. Setup Nginx reverse proxy:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

10. Setup SSL with Let's Encrypt:
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Step 5: Initial Setup

### 5.1 Create First Admin User

1. Open the app in LINE
2. Login with LINE - this creates your user in the database
3. Set your user as admin in MongoDB:

```javascript
// Connect to MongoDB
use dorm-management

// Find your user by displayName
db.users.findOne({ displayName: "Your Name" })

// Update role to admin
db.users.updateOne(
  { displayName: "Your Name" },
  { $set: { role: "admin" } }
)
```

4. Refresh the app - you should now have admin access

### 5.2 Create Rooms

Use MongoDB Compass or command line:

```javascript
// Connect to MongoDB
use dorm-management

// Insert sample rooms
db.rooms.insertMany([
  {
    roomNumber: "101",
    floor: 1,
    baseRentPrice: 3500,
    status: "vacant",
    waterRate: 18,
    electricityRate: 8,
    depositAmount: 3500
  },
  {
    roomNumber: "102",
    floor: 1,
    baseRentPrice: 3500,
    status: "vacant",
    waterRate: 18,
    electricityRate: 8,
    depositAmount: 3500
  },
  // Add more rooms...
])
```

### 5.3 Set System Configuration

```javascript
db.systemconfigs.insertMany([
  {
    key: "dueDay",
    value: 5,
    description: "Due day of month for payments"
  },
  {
    key: "defaultWaterRate",
    value: 18,
    description: "Default water rate per unit"
  },
  {
    key: "defaultElectricityRate",
    value: 8,
    description: "Default electricity rate per unit"
  },
  {
    key: "dormName",
    value: "บ้านสุขใจ",
    description: "Dormitory name"
  }
])
```

## Step 6: Testing

### 6.1 Test Admin Access

1. Open app in LINE with admin account
2. Should redirect to `/admin/dashboard`
3. Verify Bird's Eye View displays correctly

### 6.2 Test Tenant Flow

1. Generate QR Code for a room
2. Scan with different LINE account
3. Verify room assignment works
4. Create test invoice
5. Test payment flow

### 6.3 Test Payment Slip Upload

1. Create an invoice
2. Login as tenant
3. Upload a test image
4. Verify it appears in admin dashboard

## Step 7: LINE Messaging API (Optional)

For sending automated reminders and notifications:

1. Enable Messaging API in LINE channel
2. Create LINE Official Account
3. Get Messaging API access token
4. Implement notification functions:

```typescript
// Example notification
async function sendPaymentReminder(userId: string, invoice: Invoice) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: userId,
      messages: [{
        type: 'text',
        text: `แจ้งเตือน: ค่าเช่าประจำเดือนครบกำหนดชำระ\nยอด: ${invoice.totalAmount} บาท`
      }]
    })
  });
}
```

## Troubleshooting

### LIFF Init Failed
- Check LIFF ID is correct
- Verify endpoint URL matches deployment URL
- Ensure HTTPS is enabled

### Database Connection Error
- Check MongoDB URI is correct
- Verify IP whitelist in MongoDB Atlas
- Check network connectivity

### Admin Access Denied
- Check user's `role` field in database is set to `'admin'`
- Verify user exists and is active in users collection
- Use MongoDB to check: `db.users.findOne({ lineUserId: "Uxxxx" })`

### QR Code Not Working
- Verify `NEXT_PUBLIC_APP_URL` is correct
- Check token hasn't expired (24 hours)
- Ensure room is not already occupied

## Monitoring & Maintenance

### Set up logging (Vercel)
```bash
vercel logs
```

### Set up logging (PM2)
```bash
pm2 logs dorm-app
```

### Database backups (MongoDB Atlas)
- Configure automatic backups in Atlas
- Schedule: Daily

### Regular maintenance tasks:
1. Update overdue invoices: Run cron job
2. Clean expired tokens: Run weekly
3. Backup database: Run daily

## Security Checklist

- ✅ HTTPS enabled
- ✅ Environment variables secured
- ✅ MongoDB authentication enabled
- ✅ Admin role verification in place
- ✅ CORS configured properly
- ✅ Rate limiting implemented (optional)
- ✅ Input validation on all forms
- ✅ File upload size limits

## Support & Updates

Keep the system updated:
```bash
npm update
npm audit fix
```

Monitor for security updates in dependencies.
