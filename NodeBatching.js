require('dotenv').config();
const {backOff} = require('exponential-backoff');
const {google} = require('googleapis');
const http = require('http');
const url = require('url');
const opn = require('open');
const destroyer = require('server-destroy');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

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
  "https://www.googleapis.com/auth/analytics.manage.users",
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

function parseBatch(batchapiresponse){
  var boundary= '--batch_';
  var items = [];
  var responseLines = batchapiresponse.data.split(boundary);
  responseLines.splice(0,1);
  responseLines.pop();
  for(let index=0;index<responseLines.length; index++){
      let value = responseLines[index];
      var startJson = value.indexOf('{');
      var endJson = value.lastIndexOf('}');
      if (startJson < 0 || endJson < 0) 
      {
        return;               
      }
      var responseJson = value.substr(startJson, (endJson - startJson) + 1);
      responseJson=JSON.parse(responseJson);  
      items.push(responseJson);
  }
  return items;
}

function constructBatchRequest(requestType, path, requests, uid) {
    let batchContents = [];
    let batchId;
    let contentLength;

    for(request of requests) {
        let newPath = path;

        switch (requestType) {
            case 'POST':
                newPath = newPath.replace('accountId', request.accountId);
                newPath = newPath.replace('webPropertyId', request.webPropertyId);
                break;
            case 'PUT':
                newPath = newPath.replace('accountId', request.accountId);
                newPath = newPath.replace('webPropertyId', request.webPropertyId);
                newPath = newPath.replace('linkId', request.linkId);
                break;
        }

        batchContents.push(`--batch_${uid}`);
        batchContents.push('Content-Type: application/http');
        batchContents.push(`Content-ID:`);
        batchContents.push('Content-Transfer-Encoding: binary');
        batchContents.push('');
        batchContents.push(`${requestType} ${newPath}`);
        batchContents.push('Content-Type: application/json');
        batchContents.push('');
        batchContents.push('');
        batchContents.push(JSON.stringify(request));
        batchContents.push('');
    }

    batchContents.push(`--batch_${uid}--`);

    return batchContents.join('\r\n');
}

async function batchRequest(requestType, path, requests, token) {
    let limit = 1000;
    let batchChunks = [];
    let uid = uuidv4();
    let results = [];
    // If amount of requests is greater than the limit (1000), the maximum amount youn can send in a single batch request.
    // Splits requests into "chunks" to send multiple batch requests.
    if(requests.length == 0){
      return [];
    }else if(requests.length > limit) {
        let chunk = [];
        for(let i = 0; i < requests.length; i++) {
            if((i + 1) % limit !== 0) {
                batchChunks.push(chunk);
                chunk = [];
            }
            chunk.push(requests[i]);
        }
    } else{
        batchChunks.push(requests)
    }
    // Constructs request body from each chunk and sends batch request.
    for(chunk of batchChunks) {      
        let reqBody = constructBatchRequest(requestType, path, chunk, uid);
        if(!token){
          token = gaClient?.context?._options?.auth?.credentials?.access_token;
        }
        const headers = {
            headers: {
                'Content-Type': `multipart/mixed; boundary=batch_${uid}`,
                'Authorization': `Bearer ${token}`
            }
        }
        let result = parseBatch(await axios.post('https://www.googleapis.com/batch/analytics/v3', reqBody, headers));
        results.push(...result);
    }
    return results;
  }

// async function main() {    
//     auth()
//         .then(async (token) => {
//             let addUser = [
//                 {
//                     'accountId': '66031361',
//                     'webPropertyId': 'UA-66031361-19',

//                     'permissions': {
//                     'local': [
//                         "READ_AND_ANALYZE"
//                     ]
//                     },
//                     'userRef': {
//                     'email': 'aran.murphy@infotrustllc.com'
//                     }
//                 }
//             ]

//             let singleUser = [
//                 {
//                     'accountId': '66031361',
//                     'webPropertyId': 'UA-66031361-19',
//                     'linkId': 'UA-66031361-19:113110980737183910321',
//                     'permissions': {
//                         'local': ['READ_AND_ANALYZE', 'EDIT']
//                     }
//                 }
//             ]

//             let multipleUsers = [
//                 {
//                     'accountId': '66031361',
//                     'webPropertyId': 'UA-66031361-19',
//                     'linkId': 'UA-66031361-19:102820693263630713359',
//                     'permissions': {
//                         'local': ['READ_AND_ANALYZE']
//                     }
//                 },
//                 {
//                     'accountId': '66031361',
//                     'webPropertyId': 'UA-66031361-19',
//                     'linkId': 'UA-66031361-19:102820693263630713359',
//                     'permissions': {
//                         'local': ['READ_AND_ANALYZE']
//                     }
//                 },
//                 {
//                     'accountId': '66031361',
//                     'webPropertyId': 'UA-66031361-19',
//                     'linkId': 'UA-66031361-19:102820693263630713359',
//                     'permissions': {
//                         'local': ['READ_AND_ANALYZE']
//                     }
//                 }
//             ]

//             // Test single user insert
//             // batchRequest('POST', 'https://www.googleapis.com/analytics/v3/management/accounts/accountId/webproperties/webPropertyId/entityUserLinks', addUser, token.credentials.access_token); 
            
//             // Test single user update
//             // batchRequest('PUT', 'https://www.googleapis.com/analytics/v3/management/accounts/accountId/webproperties/webPropertyId/entityUserLinks/linkId', singleUser, token.credentials.access_token); 

//             // Test multiple users update
//             // console.log(await batchRequest('PUT', 'https://www.googleapis.com/analytics/v3/management/accounts/accountId/webproperties/webPropertyId/entityUserLinks/linkId', multipleUsers, token.credentials.access_token));
//         })
// }

// main();