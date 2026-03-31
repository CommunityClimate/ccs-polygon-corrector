# 🔧 TROUBLESHOOTING GUIDE

## ⚠️ "Tracking Prevention blocked access to storage"

This error occurs when your browser blocks localStorage. Here are the fixes:

### **Safari:**
1. Go to **Safari** → **Preferences** → **Privacy**
2. Uncheck **"Prevent cross-site tracking"** OR
3. Add `localhost` to exceptions
4. **Refresh the page**

### **Firefox:**
1. Click the **shield icon** in the address bar
2. Turn off **"Enhanced Tracking Protection"** for this site OR
3. Go to **Preferences** → **Privacy & Security**
4. Under "Cookies and Site Data" → click **"Manage Exceptions"**
5. Add `http://localhost:8080` and allow
6. **Refresh the page**

### **Chrome/Edge:**
1. Click the **lock icon** (or site settings) in address bar
2. Ensure **"Cookies"** is set to **"Allowed"**
3. Check that you're **not in Incognito/Private mode**
4. **Refresh the page**

### **Quick Fix - All Browsers:**
```
✅ DON'T use Private/Incognito mode
✅ Allow cookies for localhost
✅ Disable tracking prevention for localhost
```

---

## ❌ "Uncaught SyntaxError: Invalid left-hand side in assignment"

**Status:** ✅ **FIXED** in the latest version!

If you still see this:
1. Download the **FIXED** version
2. Clear browser cache (Ctrl+Shift+Delete)
3. Hard refresh (Ctrl+Shift+R)

---

## 🌐 Port 8000 Already in Use

### Find what's using it:

**Windows:**
```cmd
netstat -ano | findstr :8000
taskkill /PID <process_id> /F
```

**Mac/Linux:**
```bash
lsof -i :8000
kill -9 <PID>
```

### Or just use a different port:
```bash
python -m http.server 3000    # Port 3000
python -m http.server 5000    # Port 5000
python -m http.server 9000    # Port 9000
```

---

## 🗺️ Map Not Loading

**Causes:**
- No internet connection (map tiles need internet)
- Firewall blocking tile server

**Fix:**
1. Check internet connection
2. Open browser console (F12)
3. Look for network errors
4. Try a different network

---

## 📁 Files Not Showing (Only see 3 files)

**Don't worry!** All files are there. The interface just shows them individually.

**Solution:** Download the **ZIP file** which contains all 16 files in proper structure.

**Extract the ZIP to see:**
```
field-polygon-app/
├── config/
├── core/
├── services/
├── ui/
├── utils/
├── styles/
└── [all other files]
```

---

## 💾 Data Lost on Refresh

**Cause:** Browser storage is being blocked or cleared

**Solutions:**
1. **Disable Private Browsing** - Use normal browser mode
2. **Allow Cookies** - Enable for localhost
3. **Disable Tracking Prevention** - For this site
4. **Export Regularly** - Use export buttons to backup data

**Temporary Workaround:**
The app now uses **in-memory storage** as fallback. You'll see a warning message explaining data won't persist.

---

## 🔴 Import Not Working

**Check your file format:**

**Valid GeoJSON:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[lng, lat], [lng, lat], ...]]
      },
      "properties": {
        "ccsFieldId": "FIELD_001",
        "fieldOwner": "Name"
      }
    }
  ]
}
```

**Common Issues:**
- ❌ Missing `"type": "FeatureCollection"`
- ❌ Wrong coordinate format (should be `[lng, lat]`)
- ❌ Polygon not closed (first and last point must match)
- ❌ Invalid JSON syntax

**Test with:** `sample-data.geojson` (included in the zip)

---

## 🔄 Module Loading Errors

**Error:** `Failed to load module`

**Cause:** Opening `file://` directly instead of using a web server

**Fix:** You **MUST** use a local web server:

✅ **Option 1:** VS Code Live Server (easiest)
✅ **Option 2:** Python `python -m http.server 8000`
✅ **Option 3:** Node.js `npx http-server -p 8000`

❌ **Don't:** Double-click `index.html`

---

## 🧹 Clear All Data

If you need to reset everything:

**In Browser Console (F12):**
```javascript
localStorage.clear()
location.reload()
```

**Or:** Use browser settings → Clear site data

---

## 🆘 Still Having Issues?

1. **Check Browser Console** (F12 → Console tab)
2. **Look for red error messages**
3. **Copy the full error text**
4. **Check browser version** (needs modern browser: Chrome 90+, Firefox 88+, Safari 14+)

---

## ✅ Checklist for Success

Before running the app, ensure:

- [ ] Extracted ZIP file completely
- [ ] Using a **local web server** (not opening file directly)
- [ ] **Not** in Private/Incognito mode
- [ ] Tracking prevention **disabled** for localhost
- [ ] Cookies **allowed** for localhost
- [ ] Have **internet connection** (for map tiles)
- [ ] Using a **modern browser** (updated in last 2 years)

---

## 🎯 Quick Test

1. Start local server: `python -m http.server 8000`
2. Open: `http://localhost:8000`
3. Import: `sample-data.geojson`
4. Select field from dropdown
5. Click "Load Field"
6. Click "Validate Polygon"

If these steps work → ✅ App is working correctly!

---

**Version:** 2.0-Modular-FIXED  
**Last Updated:** 2026-02-03
