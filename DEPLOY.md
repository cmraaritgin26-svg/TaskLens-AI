# Publish This App Online

This is a static Progressive Web App. Upload all files in this folder to a web host that serves HTTPS.

Good options:

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

After publishing, open the public URL on Android Chrome and choose **Install app** or **Add to Home screen** from the browser menu.

Do not upload only the zip file as the website. Unzip it first, then publish the unzipped files so `index.html`, `manifest.webmanifest`, `service-worker.js`, `app.js`, `styles.css`, and `icons/` are at the site root.
