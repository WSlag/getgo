# Mock GCash Screenshot Template for Testing

## Quick Template for Creating Test Screenshots

Use this template to create test GCash payment screenshots for development testing.

---

## Visual Template

```
┌─────────────────────────────────────┐
│                                     │
│         [GCash Logo]                │
│                                     │
│  ✓  Transaction Successful          │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  Reference Number                   │
│  1234567890123                      │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  Send Money To                      │
│  GetGo                              │
│  09272240000                        │
│                                     │
│  Amount                             │
│  PHP 2,000.00                       │
│                                     │
│  Date & Time                        │
│  Feb 8, 2026 3:45 PM                │
│                                     │
│  Status                             │
│  Completed                          │
│                                     │
│  Transaction Fee                    │
│  FREE                               │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  [Receipt Details] [Share]          │
│                                     │
└─────────────────────────────────────┘
```

---

## Text Content Template

Copy and paste this into an image editor:

```
GCash

✓ Transaction Successful

━━━━━━━━━━━━━━━━━━━━━━━━━━

Reference Number
1234567890123

━━━━━━━━━━━━━━━━━━━━━━━━━━

Send Money To
GetGo
09272240000

Amount
PHP 2,000.00

Date & Time
Feb 8, 2026 3:45 PM

Status
Completed

Transaction Fee
FREE

━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Required Fields for OCR Verification

### 1. **Reference Number** (CRITICAL)
```
Format: 13 digits
Example: 1234567890123
Valid: 9876543210987, 1111111111111
Invalid: ABC123, 12345 (too short)
```

**OCR Pattern Match**: `\b\d{13}\b`

### 2. **Amount** (CRITICAL)
```
Format: "2000" or "2,000" or "2000.00" or "PHP 2,000.00"
Must match order amount exactly
Example: PHP 2,000.00
Valid: 2000, 2000.00, 2,000.00
Invalid: 2500, 1999.99, 20000
```

**OCR Pattern Match**: `2000|2,000|2000\.00|2,000\.00`

### 3. **Receiver Name** (CRITICAL)
```
Format: "GetGo" (case insensitive)
Must contain: GetGo
Example: GetGo, GETGO, getgo
Invalid: Get Go, GCash, Juan Cruz
```

**OCR Pattern Match**: `/getgo/i`

### 4. **Date & Time** (Recommended)
```
Format: Any recognizable date format
Must be recent (within expiry window, typically 30 min)
Example: Feb 8, 2026 3:45 PM
Valid: 2026-02-08 15:45, 08/02/2026
```

### 5. **Status** (Recommended)
```
Format: "Successful" or "Completed"
Example: Completed, Successful, Success
```

---

## Color Scheme (GCash Brand)

- **Primary Blue**: #007DFF
- **Success Green**: #00C851
- **Background**: #FFFFFF
- **Text Dark**: #1A1A1A
- **Text Light**: #6B7280
- **Divider**: #E5E7EB

---

## Fonts

GCash typically uses:
- **Primary**: SF Pro Display (iOS) / Roboto (Android)
- **Numbers**: SF Pro Text / Roboto Mono
- **Fallback**: Arial, Helvetica, sans-serif

---

## Creating Mock Screenshots - Methods

### Method 1: HTML Template (Recommended)

Save this as `mock-gcash.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .receipt {
      max-width: 400px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      padding: 30px 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .logo {
      text-align: center;
      color: #007DFF;
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 24px;
    }
    .success {
      text-align: center;
      color: #00C851;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .divider {
      border-top: 1px solid #E5E7EB;
      margin: 20px 0;
    }
    .field {
      margin-bottom: 16px;
    }
    .label {
      font-size: 12px;
      color: #6B7280;
      margin-bottom: 4px;
    }
    .value {
      font-size: 16px;
      color: #1A1A1A;
      font-weight: 500;
    }
    .ref-number {
      font-size: 20px;
      font-weight: 700;
      color: #1A1A1A;
      letter-spacing: 1px;
    }
    .amount {
      font-size: 32px;
      font-weight: 700;
      color: #00C851;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="logo">GCash</div>
    <div class="success">✓ Transaction Successful</div>

    <div class="divider"></div>

    <div class="field">
      <div class="label">Reference Number</div>
      <div class="value ref-number">1234567890123</div>
    </div>

    <div class="divider"></div>

    <div class="field">
      <div class="label">Send Money To</div>
      <div class="value">GetGo</div>
      <div class="value" style="color: #6B7280;">09272240000</div>
    </div>

    <div class="field">
      <div class="label">Amount</div>
      <div class="value amount">PHP 2,000.00</div>
    </div>

    <div class="field">
      <div class="label">Date & Time</div>
      <div class="value" id="timestamp">Feb 8, 2026 3:45 PM</div>
    </div>

    <div class="field">
      <div class="label">Status</div>
      <div class="value" style="color: #00C851;">Completed</div>
    </div>

    <div class="field">
      <div class="label">Transaction Fee</div>
      <div class="value">FREE</div>
    </div>

    <div class="divider"></div>
  </div>

  <script>
    // Auto-update timestamp to current time
    const now = new Date();
    const formatted = now.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    document.getElementById('timestamp').textContent = formatted;
  </script>
</body>
</html>
```

**Steps:**
1. Open the HTML file in a browser
2. Take a screenshot (Win+Shift+S on Windows, Cmd+Shift+4 on Mac)
3. Crop to just the white receipt area
4. Save as JPG or PNG

---

### Method 2: Canva / Figma

**Canva:**
1. Create new design (400x800px)
2. Add text elements following template above
3. Download as PNG
4. Use as screenshot

**Figma:**
1. Create frame (375x812px - iPhone size)
2. Design receipt using template
3. Export as PNG
4. Use as screenshot

---

### Method 3: Photo Editor (Photoshop/GIMP)

1. Create new image (400x800px, white background)
2. Add text layers with content from template
3. Use layers for organization:
   - Background
   - Logo
   - Success message
   - Dividers
   - Field labels
   - Field values
4. Export as JPG or PNG

---

## Realistic Variations for Testing

### Variation 1: Different Reference Numbers
```
1234567890123  ✓ Valid
9876543210456  ✓ Valid
5555555555555  ✓ Valid
0000000000000  ✓ Valid (but might look suspicious)
```

### Variation 2: Different Timestamps
```
Feb 8, 2026 3:45 PM   ✓ Recent
Feb 8, 2026 2:30 PM   ✓ Within 30 min
Feb 7, 2026 11:00 AM  ✗ Expired (>30 min)
```

### Variation 3: Amount Formats
```
PHP 2,000.00          ✓ Preferred
2000.00               ✓ Valid
2,000                 ✓ Valid
₱2,000.00             ✓ Valid
PHP 2000              ✓ Valid
```

### Variation 4: Poor Quality (to test manual review)
```
- Blurry text
- Low resolution (200x400px)
- Poor contrast
- Partial text visible
- Glare/reflections
```

---

## Quick Test Scenarios

### Test 1: Perfect Screenshot ✅
```
Reference: 1234567890123
Amount: PHP 2,000.00
Receiver: GetGo
Date: <Current time>
Status: Completed
Expected: Auto-approved in 10-30s
```

### Test 2: Amount Mismatch ❌
```
Reference: 1234567890124
Amount: PHP 1,500.00  ← Wrong amount
Receiver: GetGo
Date: <Current time>
Expected: Rejected - "Amount mismatch"
```

### Test 3: Wrong Receiver ❌
```
Reference: 1234567890125
Amount: PHP 2,000.00
Receiver: GCash Store  ← Wrong receiver
Date: <Current time>
Expected: Rejected - "Receiver name doesn't match"
```

### Test 4: Duplicate Reference ❌
```
Reference: 1234567890123  ← Same as Test 1
Amount: PHP 2,000.00
Receiver: GetGo
Date: <Current time>
Expected: Rejected - "Duplicate reference number"
```

### Test 5: Expired Order ❌
```
Reference: 1234567890126
Amount: PHP 2,000.00
Receiver: GetGo
Date: Feb 7, 2026 1:00 PM  ← Old timestamp
Expected: Rejected - "Transaction too old"
```

### Test 6: Blurry/Unclear (Manual Review) ⏱️
```
Reference: [Unclear/blurry]
Amount: PHP 2,000.00 [Partially visible]
Receiver: GetGo [Low confidence]
Date: <Current time>
Expected: Manual review required
```

---

## Screenshot File Specifications

- **Resolution**: 400x800px minimum, 1080x1920px recommended
- **Format**: JPG (best compatibility) or PNG
- **File Size**: Under 5MB (preferably 500KB-2MB)
- **Color Mode**: RGB
- **DPI**: 72-150 (screen resolution)

---

## Common OCR Mistakes to Avoid

❌ **Cursive/Script Fonts**
   - OCR struggles with fancy fonts
   - Use clean, sans-serif fonts

❌ **Low Contrast**
   - Gray text on white background may not read well
   - Use dark text (#1A1A1A) on white

❌ **Small Text**
   - Minimum 12px for good OCR results
   - Reference number should be 16px+

❌ **Image Compression**
   - Heavy JPG compression creates artifacts
   - Use quality 80-95% for JPGs

❌ **Rotation/Skew**
   - Keep text perfectly horizontal
   - No tilted phone screenshots

---

## Real GCash Receipt Examples

If you want ultra-realistic screenshots, study real GCash receipts:

1. Check GCash's official documentation
2. Look at GCash app screenshots in app stores
3. Search "GCash receipt" on Google Images (for reference only)
4. Note differences between iOS and Android UI

**Key Visual Elements:**
- GCash logo (blue)
- Green checkmark for success
- Clear section dividers
- Amount prominently displayed
- Monospace font for reference number
- Small text for transaction fee
- Share/Download buttons at bottom

---

## Testing Tips

1. **Generate unique reference numbers** for each test:
   ```javascript
   const refNum = Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0');
   console.log(refNum); // e.g., "0123456789012"
   ```

2. **Use current timestamp** to avoid expiry issues:
   ```javascript
   const now = new Date().toLocaleString('en-US', {
     year: 'numeric', month: 'short', day: 'numeric',
     hour: 'numeric', minute: '2-digit', hour12: true
   });
   ```

3. **Test both success and failure paths**
   - Create intentionally wrong screenshots to test validation

4. **Document which reference numbers you've used**
   - Avoid reusing same numbers (will trigger duplicate detection)

---

## Troubleshooting Mock Screenshots

### OCR Can't Read Reference Number
- **Fix**: Increase font size to 20px+
- **Fix**: Use monospace font (Courier New, Consolas)
- **Fix**: Add more spacing between digits

### Amount Not Detected
- **Fix**: Include "PHP" or "₱" symbol
- **Fix**: Use comma separator: "2,000.00"
- **Fix**: Make amount larger and bold

### Receiver Name Mismatch
- **Fix**: Ensure exact match: "GetGo" (not "Get Go")
- **Fix**: Check for extra spaces or special characters

### Always Goes to Manual Review
- **Fix**: Increase image resolution (1080px width minimum)
- **Fix**: Use higher contrast colors
- **Fix**: Save as PNG instead of JPG for better text quality

---

**Last Updated**: February 8, 2026
**Use Case**: Development and Testing Only
**Status**: Ready to Use
