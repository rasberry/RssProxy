var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var async = require('async');

var SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
var TOKEN_PATH = 'credentials/gmail-api-quickstart.json';



function getSecretFile(callback) {
	// Load client secrets from a local file.
	fs.readFile('client_secret.json', function processClientSecrets(err, content) {
		if (err) {
			console.log('Error loading client secret file: ' + err);
			callback(err,null);
		} else {
			callback(null,JSON.parse(content) || {})
		}
		// Authorize a client with the loaded credentials, then call the
		// Gmail API.
		//authorize(JSON.parse(content), listLabels);
		//authorize(JSON.parse(content),listMessages);
	});
}

/**
* Create an OAuth2 client with the given credentials, and then execute the
* given callback function.
*
* @param {Object} credentials The authorization client credentials.
* @param {function} callback The callback to call with the authorized client.
*/
function authorize(credentials, callback) {
	var clientSecret = credentials.installed.client_secret;
	var clientId = credentials.installed.client_id;
	var redirectUrl = credentials.installed.redirect_uris[0];
	var auth = new googleAuth();
	var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

	// Check if we have previously stored a token.
	fs.readFile(TOKEN_PATH, function(err, token) {
		if (err) {
			getNewToken(oauth2Client, callback);
		} else {
			oauth2Client.credentials = JSON.parse(token);
			callback(null,oauth2Client);
		}
	});
}

/**
* Get and store new token after prompting for user authorization, and then
* execute the given callback with the authorized OAuth2 client.
*
* @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
* @param {getEventsCallback} callback The callback to call with the authorized
*     client.
*/
function getNewToken(oauth2Client, callback) {
	var authUrl = oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES
	});
	console.log('Authorize this app by visiting this url: ', authUrl);
	var rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	rl.question('Enter the code from that page here: ', function(code) {
		rl.close();
		oauth2Client.getToken(code, function(err, token) {
			if (err) {
				console.log('Error while trying to retrieve access token', err);
				callback(err)
			} else {
				oauth2Client.credentials = token;
				storeToken(token);
				callback(null,oauth2Client);
			}
		});
	});
}

/**
* Store token to disk be used in later program executions.
*
* @param {Object} token The token to store to disk.
*/
function storeToken(token) {
	fs.writeFile(TOKEN_PATH, JSON.stringify(token));
	console.log('Token stored to ' + TOKEN_PATH);
}

/**
* Lists the labels in the user's account.
*
* @param {google.auth.OAuth2} auth An authorized OAuth2 client.
*/
function listLabels(auth) {
	var gmail = google.gmail('v1');
	gmail.users.labels.list({
		auth: auth,
		userId: 'me',
	}, function(err, response) {
		if (err) {
			console.log('The API returned an error: ' + err);
			return;
		}
		var labels = response.labels;
		if (labels.length == 0) {
			console.log('No labels found.');
		} else {
			console.log('Labels:');
			for (var i = 0; i < labels.length; i++) {
				var label = labels[i];
				console.log('- %s', label.name);
			}
		}
	});
}

function getMessageList(auth,callback) {
	var gmail = google.gmail('v1');
	gmail.users.messages.list({
		auth:auth
		,userId:'me'
		,maxResults:10
		,q:'-category:promotions'
	}, function(err, res) {
		if (err) {
			console.log('The API returned an error: ' + err);
			callback(err);
		} else {
			//res = {messages:[{id:'',threadId:''},...],nextPageToken:'',resultSizeEstimate:0}
			callback(null,auth,res);
		}
	});
}

function getMessage(auth,id,callback) {
	var gmail = google.gmail('v1');
	gmail.users.messages.get({
		auth:auth
		,userId:'me'
		,id:id
		,format:'metadata'
	},function(err,message) {
		if (err) {
			console.log('Failed to get message '+id);
			callback(err);
		} else {
			callback(null,message);
		}
	});
}

function getMessageListContent(auth,list,callback) {
	var idList = list.messages;
	var arr = [];
	async.each(
		idList
		,function(mid,cb) {
			getMessage(auth,mid.id,function(err,message) {
				if (!err) {
					arr.push(message);
				}
				cb(err);
			});
		}
		,function(err) {
			callback(err,arr);
		}
	);
}

function printMessageList(list,callback) {
	
	list.sort(function(a,b) {
		return b.internalDate - a.internalDate;
	});
	
	for(var len=list.length, m=0; m<len; m++) {
		//console.dir(list[m],{depth:10});
		
		var c = list[m];
		var id = c.id;
		var idate = c.internalDate;
		var desc = c.snippet;
		var heads = c.payload.headers;
		var efrom = null;
		var subj = null;
		var edate = null;
		
		for(var hl=heads.length, h=0; h<hl; h++) {
			var name = heads[h].name;
			if (name == 'From') {
				efrom = heads[h].value;
			} else if (name == 'Subject') {
				subj = heads[h].value;
			} else if (name == 'Date') {
				edate = heads[h].value;
			}
		}
		
		console.log(id+' '+edate+' '+efrom+' '+subj+' '+desc);
		
		//console.dir(list[m],{depth:10});
	}
	callback();
}

// /**
//  * Retrieve Messages in user's mailbox matching query.
//  *
//  * @param  {String} userId User's email address. The special value 'me'
//  * can be used to indicate the authenticated user.
//  * @param  {String} query String used to filter the Messages listed.
//  * @param  {Function} callback Function to call when the request is complete.
//  */
// function listMessages(userId, query, callback) {
// 	var getPageOfMessages = function(request, result) {
// 		request.execute(function(resp) {
// 			result = result.concat(resp.messages);
// 			var nextPageToken = resp.nextPageToken;
// 			if (nextPageToken) {
// 				request = gapi.client.gmail.users.messages.list({
// 					'userId': userId,
// 					'pageToken': nextPageToken,
// 					'q': query
// 				});
// 				getPageOfMessages(request, result);
// 			} else {
// 				callback(result);
// 			}
// 		});
// 	};
// 	var initialRequest = gapi.client.gmail.users.messages.list({
// 		'userId': userId,
// 		'q': query
// 	});
// 	getPageOfMessages(initialRequest, []);
// }

function main() {
	async.waterfall([
		getSecretFile
		,authorize
		,getMessageList
		,getMessageListContent
		,printMessageList
	],function(err) {
		if (err) {
			console.log(err);
		}
	});
}
main();
