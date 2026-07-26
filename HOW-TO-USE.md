# How to use GENEVIEVE Super Response v1.7

## First use after deployment

1. Open your live Vercel address.
2. Scroll to **Private access code required**.
3. Enter the same value you saved in Vercel as `APP_ACCESS_CODE`.
4. Select **Run real API connection test**.
5. Wait for the three provider results.

A provider is usable only when it says **READY**. “Configured” means Vercel found a variable; it does not prove the key has billing, permission or a working model.

## Ask a question

1. Enter the private access code if it is not already filled.
2. Type a detailed question in **Your question**.
3. Tick the providers you want to consult. Leave only providers marked **Ready** selected.
4. Keep **Final answer editor** on **Automatic best available**.
5. Choose:
   - **Balanced** for faster, cheaper answers.
   - **Deep expert panel** for independent expert roles, synthesis and final review.
6. Select **Build Super Best Answer**.
7. Read the individual provider cards and the final combined answer.
8. Use **Copy answer** to copy the final result.

## What each connection result means

- **READY:** the app completed a real API generation request.
- **Authentication failed:** the provider rejected the key. Create a new key and replace it in Vercel.
- **Billing, quota or rate limit:** the key exists, but the provider account cannot currently run the request. Add credits, enable billing or wait for the limit to reset.
- **Access restricted:** the key or project lacks permission, or Google key restrictions block the request.
- **Model unavailable:** the selected model is not available. v1.7 automatically chooses a compatible model when possible.
- **Private access code missing or incorrect:** enter the exact `APP_ACCESS_CODE` stored in Vercel.

## After changing any Vercel variable

1. Save the variable for **Production and Preview**.
2. Redeploy the Production deployment.
3. Reopen the live site.
4. On iPhone, close the browser tab and reopen it if the old screen remains.
5. Run the real connection test again.
