require('dotenv').config();
const {google} = require('googleapis');
const {backOff} = require('exponential-backoff');
const http = require('http');
const url = require('url');
const opn = require('open');
const destroyer = require('server-destroy');

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL
);

const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/ddmconversions",
  "https://www.googleapis.com/auth/dfareporting",
  "https://www.googleapis.com/auth/dfatrafficking",
  "https://www.googleapis.com/auth/analytics",
  "https://www.googleapis.com/auth/tagmanager",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/doubleclicksearch",
  "https://www.googleapis.com/auth/webmasters",
  ];

const authorizeUrl = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: 'offline',
  
    // If you only need one scope you can pass it as a string
    scope: scopes
});

const tagmanager = google.tagmanager('v2');
const containers = tagmanager.accounts.containers;
google.options({auth: oauth2Client});

function auth() {
    return new Promise((resolve, reject) => {
        const server = http
        .createServer(async (req, res) => {
            try {
            if (req.url.indexOf('/oauth2callback') > -1) {
                const qs = new url.URL(req.url, 'http://localhost:3000')
                .searchParams;
                res.end('Authentication successful! Please return to the console.');
                server.destroy();
                const {tokens} = await oauth2Client.getToken(qs.get('code'));
                oauth2Client.credentials = tokens; // eslint-disable-line require-atomic-updates
                console.log(oauth2Client)
                resolve(oauth2Client);
            }
            } catch (e) {
            reject(e);
            }
        })
        .listen(3000, () => {
            // open the browser to the authorize url to start the workflow
            opn(authorizeUrl, {wait: false}).then(cp => cp.unref());
        });
        destroyer(server);
    });
}

async function main(){    
    auth()
        .then(async () => {
            
        })
}

main();