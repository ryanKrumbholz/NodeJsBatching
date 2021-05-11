require('dotenv').config();
const {google} = require('googleapis');
const http = require('http');
const url = require('url');
const opn = require('open');
const destroyer = require('server-destroy');
const axios = require('axios');

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

function constructBatchRequest(requests) {
    let batchContents = [];
    let batchId;
    let contentLength;
    let jsonObject;
    let path;
    for(let i = 0; i < requests.length; i++) {
        chunkContents.push(`--batch_${batchId}`);
        batchContents.push('Content-Type: application/http');
        batchContents.push(`Content-ID: ${contentId}`);
        batchContents.push(`Content-Transfer-Encoding: ${encoding}`);
        batchContents.push('');
        batchContents.push('');
        batchContents.push(`POST ${path}`);
        batchContents.push('Content-Type: application/json');
        batchContents.push(`Content-Length: ${contentLength}`);
        batchContents.push('');
        batchContents.push('');
        batchContents.push(jsonObject);
        batchContents.push('');
    }

    return batchContents.join('\r\n');
}

function batchRequest(requests, token) {
    let limit = 1000;
    let batchChunks = [];

    // If amount of requests is greater than the limit (1000), the maximum amount youn can send in a single batch request.
    // Splits requests into "chunks" to send multiple batch requests.
    if(requests.length > limit) {
        let chunk = [];
        for(let i = 0; i < requests.length; i++) {
            if((i + 1) % limit !== 0) {
                batchChunks.push(chunk);
                chunk = [];
            }
            chunk.push(requests[i]);
        }
    } else {
        batchChunks.push(requests)
    }

    // Constructs request body from each chunk and sends batch request.
    for(chunk in batchChunks) {        
        let reqBody = constructBatchRequest(chunk);
        const headers = {
            headers: {
                'Content-Type': 'multipart/mixed',
                'Authorization': `Bearer ${token.access_token}`
            }
        }

        try {
            axios.post('/batch/analytics/v3', reqBody, headers).then(res => {
                console.log(res)
            })
        } catch(err) {
            console.log(err);
        }
    }    
}

async function main() {    
    auth()
        .then(async (token) => {
            batchRequest(requests, token);
        })
}

main();