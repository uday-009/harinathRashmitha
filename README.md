# Harinath & Rashmitha - Wedding Invitation

## Run
In PowerShell:
    $env:UPLOAD_PASSWORD = "choose-a-password"
    npm start

Node 18+ is required; no `npm install` is needed to run locally.
Site: http://localhost:3000   |   Photo upload page: /uploadimages

## Photos
- The gallery shows the first 4 photos; the rest sit behind "View more photos".
- The password-protected `/uploadimages` page allows multiple gallery photo uploads and separate bride/groom portrait uploads.
- Gallery photos appear in Captured Moments; portrait uploads replace their respective portraits on the invitation.
- Replace `assests/photos/groom.jpg` and `assests/photos/bride.jpg` with the final portraits before deploying to keep them in the project.
- Uploads are saved in `uploads/` (or `UPLOAD_DIR`) and are temporary on Render Free.

## Hosting (needs a host that runs Node and keeps its disk)
Use a VPS, or Render/Railway with a persistent disk/volume mounted at the uploads folder (set UPLOAD_DIR to it). On free tiers without a disk, uploads disappear when the server restarts. Static hosts (Netlify, GitHub Pages) show the invitation but NOT uploads.
Set `UPLOAD_PASSWORD` in the host's environment settings. The server will not start without it.

## Render Free (temporary uploads)
1. Push the project to a GitHub repository and create a Render **Web Service** from it.
2. Set the service root directory to the folder containing `package.json` if the project is in a subfolder.
3. Use build command `npm install` and start command `npm start`.
4. Add `UPLOAD_PASSWORD` in the Render service's environment variables. Render supplies `PORT` automatically.

The server binds to `0.0.0.0` for Render. Free services spin down after 15 minutes without traffic, and their local files are erased on spin-down, restart, or redeploy. Photos uploaded to this temporary deployment may disappear during the two-day event.

## Settings (top of script.js)
GROOM_WHATSAPP (RSVP number), STORY_VIDEO_ID (YouTube video id)
The invitation uses `assests/photos/groom.jpg` and `assests/photos/bride.jpg` as its default portraits.
