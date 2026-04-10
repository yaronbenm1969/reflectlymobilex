/**
 * Deploy Firestore security rules using Firebase Management API.
 * Run from project root:
 *   cd server
 *   node scripts/deploy-firestore-rules.js
 *
 * Requires: FIREBASE_PROJECT_ID + a service account with
 * "Firebase Rules Admin" or "Firebase Admin" role.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const https = require('https');
const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const rulesPath = path.join(__dirname, '../../firestore.rules');
const rulesSource = fs.readFileSync(rulesPath, 'utf8');
const projectId = process.env.FIREBASE_PROJECT_ID;

async function getAccessToken() {
  // Use the firebase-admin credential directly (no extra package needed)
  const { getApps } = require('firebase-admin/app');
  const app = getApps()[0];
  const tokenResult = await app.options.credential.getAccessToken();
  return tokenResult.access_token;
}

(async () => {
  console.log(`\nDeploying Firestore rules to project: ${projectId}\n`);
  console.log('Rules source:');
  console.log(rulesSource);
  console.log('\n---\n');

  try {
    const token = await getAccessToken();

    // Create a new ruleset
    const createBody = JSON.stringify({
      source: {
        files: [{ name: 'firestore.rules', content: rulesSource }],
      },
    });

    const ruleset = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'firebaserules.googleapis.com',
          path: `/v1/projects/${projectId}/rulesets`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(createBody),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(data)); }
          });
        }
      );
      req.on('error', reject);
      req.write(createBody);
      req.end();
    });

    if (ruleset.error) throw new Error(JSON.stringify(ruleset.error));
    const rulesetName = ruleset.name;
    console.log(`✅ Ruleset created: ${rulesetName}`);

    // Release the ruleset to the default Firestore service
    const releaseBody = JSON.stringify({
      release: { name: `projects/${projectId}/releases/cloud.firestore`, rulesetName },
    });
    const release = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'firebaserules.googleapis.com',
          path: `/v1/projects/${projectId}/releases/cloud.firestore?updateMask=rulesetName`,
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(releaseBody),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(data)); }
          });
        }
      );
      req.on('error', reject);
      req.write(releaseBody);
      req.end();
    });

    if (release.error) throw new Error(JSON.stringify(release.error));
    console.log(`✅ Rules deployed! Release: ${release.name}`);
    console.log('\n✅ Firestore rules updated — backgrounds collection is now publicly readable.\n');
  } catch (err) {
    console.error('❌ Deploy failed:', err.message);
    console.log('\n📋 Manual alternative:');
    console.log('   1. Open https://console.firebase.google.com');
    console.log(`   2. Project: ${projectId} → Firestore → Rules`);
    console.log('   3. Paste the contents of firestore.rules and publish');
  }
  process.exit(0);
})();
