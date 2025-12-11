# Environment Setup Testing Checklist

Follow these steps to verify your dev/production environment setup is working correctly.

## ✅ Step 1: Verify Development Server is Running

**Status:** ✓ Server is running at http://localhost:3000

Check that you see:
```
Compiled successfully!
You can now view handyman-platform in the browser.
Local: http://localhost:3000
```

---

## ✅ Step 2: Check Browser Console for Environment Logs

1. Open your browser to: **http://localhost:3000**
2. Open Developer Tools (F12 or Right-click → Inspect)
3. Go to the **Console** tab

### Expected Output:

You should see these logs:

```javascript
🔧 Environment Configuration: {
  environment: 'development',
  database: 'devs',
  approvalBaseUrl: 'http://localhost:3000/admin/approve-handyman',
  isDevelopment: true,
  isProduction: false,
  apiUrl: 'http://localhost:5001/eazydone-d06cf/us-central1',
  features: { ... }
}

🔥 Firebase initialized with database: devs
```

### ✓ What to Verify:
- [ ] `environment` is **'development'**
- [ ] `database` is **'devs'**
- [ ] `approvalBaseUrl` points to **localhost:3000**
- [ ] `isDevelopment` is **true**
- [ ] Firebase initialized message shows **'devs'** database

---

## ✅ Step 3: Test Database Write to Dev Database

Let's verify that data is being written to the **devs** database (not default):

### Option A: Register a Test Handyman

1. Go to: http://localhost:3000/handyman/register
2. Fill out the registration form with test data
3. Submit the form

### Option B: Create a Test Job (as Customer)

1. Go to: http://localhost:3000
2. Create a new job request
3. Fill in details and submit

### Verification:

1. Go to [Firebase Console - Firestore](https://console.firebase.google.com/project/eazydone-d06cf/firestore)
2. **Switch to 'devs' database** using the dropdown at the top
3. Look for your test data in the collections (handymen, jobs, users, etc.)
4. **Important:** Check the **(default)** database - it should NOT have this test data

### ✓ What to Verify:
- [ ] New data appears in **'devs'** database
- [ ] **(default)** database remains unchanged
- [ ] No errors in browser console
- [ ] Application functions normally

---

## ✅ Step 4: Test Email Approval URLs (Development)

If you register a test handyman:

1. Check your operations email inbox
2. Open the approval notification email
3. Hover over the "Approve Registration" button
4. Verify the link shows: `http://localhost:3000/admin/approve-handyman?token=...`

### ✓ What to Verify:
- [ ] Approval URL points to **localhost:3000** (not production)
- [ ] Clicking the link opens localhost (not production site)

---

## ✅ Step 5: Build for Production (Test Build)

Let's verify the production build works:

```bash
npm run build
```

### Expected Output:
```
Creating an optimized production build...
Compiled successfully.

The build folder is ready to be deployed.
```

### ✓ What to Verify:
- [ ] Build completes without errors
- [ ] `/build` folder is created
- [ ] No TypeScript or linting errors

---

## ✅ Step 6: Test Production Configuration (Simulated)

To test what will happen in production WITHOUT actually deploying:

1. Stop the dev server (Ctrl+C)
2. Temporarily serve the production build:

```bash
npx serve -s build -l 8080
```

3. Open: http://localhost:8080
4. Open Developer Console

### Expected Behavior:

**On localhost:8080** (still localhost, so still uses dev):
- Environment: 'development' (because hostname is still localhost)
- Database: 'devs'
- Approval URL: localhost:3000

**This is CORRECT!** Even the production build uses dev settings when on localhost.

### ✓ What to Verify:
- [ ] Production build runs without errors
- [ ] Still uses 'devs' database (because on localhost)

---

## ✅ Step 7: Verify Production Will Use Correct Settings

The app will automatically switch to production settings when deployed to Firebase Hosting.

### What happens when deployed:

When you run `firebase deploy`, the app will be hosted at:
- `https://eazydone-d06cf.web.app`

At that URL, the environment detection will see the hostname and automatically:
- Set environment to **'production'**
- Use **(default)** database
- Use production approval URL: `https://eazydone-d06cf.web.app/admin/approve-handyman`

### No manual configuration needed!

---

## ✅ Step 8: Check Firebase Security Rules (Both Databases)

Verify both databases have the same security rules:

1. Go to [Firestore Rules](https://console.firebase.google.com/project/eazydone-d06cf/firestore/rules)
2. Check dropdown shows both databases have rules

If rules are missing for 'devs':
```bash
firebase deploy --only firestore:rules
```

### ✓ What to Verify:
- [ ] Both **(default)** and **devs** databases have security rules
- [ ] Rules are identical

---

## ✅ Step 9: Verify Git Branches

Check your branch structure:

```bash
git branch -a
```

### Expected Output:
```
* dev
  main
  master
  remotes/origin/dev
  remotes/origin/main
  remotes/origin/master
```

### ✓ What to Verify:
- [ ] `dev` branch exists locally and remotely
- [ ] `main` branch exists locally and remotely
- [ ] You're currently on `dev` branch (*)

---

## ✅ Step 10: Review What Each Branch Should Be Used For

### **dev branch** (Current - Your Daily Work)
```bash
git checkout dev
npm start
```
- Daily development
- Testing new features
- Uses **devs** database
- Approval emails link to localhost

### **main branch** (Production Deployments)
```bash
git checkout main
git merge dev
npm run build
firebase deploy
```
- Production-ready code only
- Deploys to Firebase Hosting
- Uses **(default)** database automatically
- Approval emails link to production URL automatically

---

## 🎯 Summary Checklist

Before proceeding, confirm ALL of these:

- [ ] ✅ Dev server runs successfully on localhost:3000
- [ ] ✅ Browser console shows `environment: 'development'`
- [ ] ✅ Browser console shows `database: 'devs'`
- [ ] ✅ Test data writes to 'devs' database (not default)
- [ ] ✅ Approval URLs in emails point to localhost
- [ ] ✅ Production build completes without errors
- [ ] ✅ Both databases have security rules deployed
- [ ] ✅ Git branches (dev/main) exist and are synced

---

## 🚀 Next Steps

Once all tests pass:

1. **Commit the database name change:**
   ```bash
   git add -A
   git commit -m "Fix: Update database name to 'devs'"
   git push origin dev
   ```

2. **Merge to main for production:**
   ```bash
   git checkout main
   git merge dev
   git push origin main
   ```

3. **Deploy to production:**
   ```bash
   npm run build
   firebase deploy
   ```

4. **Test production deployment:**
   - Visit: https://eazydone-d06cf.web.app
   - Check console: should show `environment: 'production'`, `database: '(default)'`
   - Register a test handyman
   - Verify data goes to **(default)** database
   - Verify approval email links to production URL

---

## 🐛 Troubleshooting

### Issue: Wrong database being used

**Solution:** Check hostname detection
```javascript
// In browser console:
console.log(window.location.hostname);
// Should be 'localhost' for dev, 'eazydone-d06cf.web.app' for prod
```

### Issue: Data not appearing in any database

**Solution:** Check Firestore security rules and authentication
- Ensure you're logged in (if required)
- Check browser console for permission errors

### Issue: Environment shows 'production' on localhost

**Solution:** Clear cache and hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

---

## 📞 Need Help?

If something doesn't match the expected behavior:
1. Check the browser console for errors
2. Review `/src/config/environment.js`
3. Verify Firebase security rules are deployed
4. Check you're on the correct git branch
