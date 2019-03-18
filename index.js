var fs = require('fs');
var http = require('http');
var https = require('https');
const express = require("express");
const request = require("request");
const bodyParser = require("body-parser");

// global constant 
const c_max_check_delay = 5 * 60 * 1000; // 5 minutes between account check

// global variables
var g_curr_warlock_index = -1;
var g_check_started = 0;
var g_check_delay = 0;
var g_max_user_id = 0;
var g_max_warlock_id = 0;
var g_message_count = 0;
var garr_user = {};
var garr_warlock = {};
var garr_warlock_id = [];
var garr_fbuid = {};

// DB
var mysql = require('mysql');
var mysql_db;
var db_params = { host: process.argv[2], user: process.argv[3], password: process.argv[4], database: process.argv[5]};

function handleDisconnect() {
  mysql_db = mysql.createConnection(db_params); // Recreate the connection, since the old one cannot be reused.
  mysql_db.connect(function(err) {
      if (err) {
        console.log('error when connecting to db:', err);
        setTimeout(handleDisconnect, 2000);
        return;
      }
      console.log("MYSQL Connected!");
    }
  );

  mysql_db.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') {
      handleDisconnect();
    } else {
      throw err;
    }
  });
}

handleDisconnect();

function getObjectCode(id, type) {
  return '' + type + '' + id;
  /*switch(type) {
    case 'f': return 'f' + id;
    case 'w': return 'w' + id; // warlock
    case 'u':                  // user
    default: return 'u' + id;
  }*/
}

function getNextUserID() {
  return ++g_max_user_id;
}

function getNextWarlockID() {
  return ++g_max_warlock_id;
}

function loadDBData() {
  loadDBUsers();
}

function loadDBUsers() {
   console.log('loadDBData', 'load users', 'start');
   mysql_db.query('select * from sn_user', [], function (err, db_res) {
        if (err) {
          console.log('select * from sn_user', err);
          return;
        }
        console.log('loadDBData', 'load users', 'receive data', db_res.length);
        for (var i = 0; i < db_res.length; ++i) {
          garr_user[getObjectCode(db_res[i].user_id)] = {uid:db_res[i].user_id,fuid:db_res[i].facebook_uid,last_msg_date:db_res[i].last_msg_date,
                                                              delay_level:db_res[i].delay_level,hint_show:db_res[i].hint_show,sleep:db_res[i].sleep};
          garr_fbuid[getObjectCode(db_res[i].facebook_uid, 'f')] = db_res[i].user_id;
          if (g_max_user_id < db_res[i].user_id) {
            g_max_user_id = db_res[i].user_id;
          }
        }  
        console.log('loadDBData', 'load users', 'finish', g_max_user_id);
        
        loadDBWarlocks();
      });
}
  
function loadDBWarlocks() {
    console.log('loadDBData', 'load warlock', 'start');
    mysql_db.query('select * from sn_warlock', [], function (err, db_res) {
        if (err) {
          console.log('select * from sn_warlock', err);
          return;
        }
        
        console.log('loadDBData', 'load warlock', 'receive result');
        for (var i = 0; i < db_res.length; ++i) {
          garr_warlock[getObjectCode(db_res[i].warlock_id, 'w')] = {wid:db_res[i].warlock_id,login:db_res[i].login,listener:[]};
          garr_warlock_id.push(db_res[i].warlock_id);
          if (g_max_warlock_id < db_res[i].warlock_id) {
            g_max_warlock_id = db_res[i].warlock_id;
          }
        }
        console.log('loadDBData', 'load warlock', 'finish', g_max_warlock_id);
        
        loadDBListener();
      });
    
}
    
function loadDBListener() {
    console.log('loadDBData', 'load warlock listener', 'start');
    mysql_db.query('select * from sn_warlock_listener' , [], function (err, db_res) {
        if (err) {
          console.log('select * from sn_warlock_listener', err);
          return;
        }
        
        console.log('loadDBData', 'load warlock listener', 'receive result');
        for (var i = 0; i < db_res.length; ++i) {
          var wc = getObjectCode(db_res[i].warlock_id, 'w');
          if (garr_warlock[wc] && (garr_warlock[wc].listener.indexOf(db_res[i].user_id) === -1)) {
            garr_warlock[wc].listener.push(db_res[i].user_id);
          }
        }
        console.log('loadDBData', 'load warlock listener', 'finish');
        
        checkWarlock();
      });
}


function prepareWarlockIndex() {
  if (garr_warlock_id.length === 0) {
    g_check_delay = c_max_check_delay;
    console.log('prepareWarlockIndex', 'garr_warlock_id empty, next run in 5 minutes');
    return false;
  }
  
  if (++g_curr_warlock_index > garr_warlock_id.length) {
    g_curr_warlock_index = 0;
  }
  if (g_curr_warlock_index === 0) {
    var last_check_ms = 1000 * (time() - g_check_started)
    if (last_check_ms < c_max_check_delay) {
      // last check started 
      g_check_delay = Math.max(c_max_check_delay - last_check_ms, 15000);
      g_curr_warlock_index = -1;
      return false;
    }
    g_check_started = time();
  }
  g_check_delay = 20000;
  
  return true;
}

function removeWarlock(warlock_id) {
  
}

function alertWarlock(warlock_id, arr_battle_ids, last_activity_minutes) {
  if (last_activity_minutes <= 2) {
    console.log('alertWarlock', warlock_id, last_activity_minutes, 'warlock looks active');
    return;
  }
  
  var warlock_code = getObjectCode(warlock_id, 'w');
  var warlock = garr_warlock[warlock_code];
  if (!warlock || !warlock.listener) {
    console.log('alertWarlock', warlock_id, warlock_code, 'not found');
    return;
  }
  
  if (warlock.listener.length === 0) {
    console.log('alertWarlock', warlock_id, warlock_code, 'no listener');
    return;
  }
  
  for (var i = 0, Ln = warlock.listener.length; i < Ln; ++i) {
    var user = garr_user[getObjectCode(warlock.listener[i])];
    if (!user) {
      console.log('alertWarlock', warlock.listener[i], getObjectCode(warlock.listener[i]), 'user not found');
      continue;
    }
    var fb_uid = user.fuid;
    if (!fb_uid) {
      console.log('alertWarlock', warlock.listener[i], getObjectCode(warlock.listener[i]), user, 'user with empty facebook id');
      continue;
    }
    var str_battles = '';//= '\n';
    /*for(var j = 0, Ln = arr_battle_ids.length; j < Ln; ++j) {
      str_battles += 'https://games.ravenblack.net/warlocks?num=' + arr_battle_ids[j] + '\n';
    }*/
    console.log('before sendMessageToUser', warlock.listener[i], getObjectCode(warlock.listener[i]), garr_user[getObjectCode(warlock.listener[i])]);
    sendMessageToUser(garr_user[getObjectCode(warlock.listener[i])], 
                      {text: 'Warlock ' + warlock.login.toUpperCase() + ' has battle wait for orders!'+ str_battles
                             //'https://games.ravenblack.net/player/' + warlock.login + '.html'
                             });
    /*
    {text: 'Warlock ' + warlock.login. + ' has battle ready to fight!\n' + 
                               'Web: https://games.ravenblack.net/player/' + warlock.login + '.html\n' +
                               'Android: https://play.google.com/store/apps/details?id=net.is.games.WarlocksDuel'}
    */
  }
}

function getFieldVaue(data, search, value_from, value_to) {
  var idx1 = data.indexOf(search);
  if (idx1 === -1) {
    return '';
  }
  idx1 = data.indexOf(value_from, idx1);
  idx1 += value_from.length;
  var idx2 = data.indexOf(value_to, idx1);
  return data.substr(idx1, idx2 - idx1);
}

function getInt(str, with_sing) {
  return (with_sing === true ? str.replace(/[^0-9\-]/g, '') : str.replace(/[^0-9]/g, '')) * 1;
}

function parseLastActivity(body) {
  var val = getFieldVaue(body, 'Last Active:', '<TD>', '</TD>');
  var k = 1;
  if (val.indexOf('minutes') != -1) {
    
  } else if (val.indexOf('hour') != -1) {
    k = 60;
  } else if (val.indexOf('day') != -1) {
    k = 60 * 24;
  }
  
  return k * getInt(val);
}

function parseBattles(body) {
  var res = [];
  var idx1 = body.indexOf('Ready in battles');
  var idx2 = body.indexOf('</TABLE></TD></TR>', idx1);
  var idx3 = idx1;
  while((idx3 = body.indexOf('HREF="/warlocks?num=', idx3)) != -1) {
    idx3 += 20;
    if (idx3 > idx2) {
      break;
    }
    var idx4 = body.indexOf('"', idx3);
    var battle_id = body.substr(idx3, idx4 - idx3);
    res.push(battle_id);
  }
  
  return res;
}

function checkWarlockActivity(warlock_id, not_in_cycle) {
  console.log('checkWarlockActivity', warlock_id, not_in_cycle);
  var warlock_code = getObjectCode(warlock_id, 'w');
  if (!garr_warlock[warlock_code]) {
    console.log('checkWarlockActivity', 'warlock not found', warlock_id, warlock_code);
    return false;
  }
  var warlock = garr_warlock[warlock_code];
  if (!warlock) {
    console.log('checkWarlockActivity', 'warlock not found', warlock_id, warlock_code);
    return false;
  }
  
  if (!warlock.listener || (warlock.listener.length === 0)) {
    console.log('checkWarlockActivity', 'warlock with no listener', warlock_id, warlock_code);
    return false;
  }
  
  var warlock_login = warlock.login;
  if (!warlock_login) {
    console.log('checkWarlockActivity', 'warlock with wrong login', warlock_id, warlock_code, warlock_login);
    return false;
  }
  
  request('https://games.ravenblack.net/player/'+warlock_login+'.html', function (error, response, body) {
    if (error) {
      console.log('error['+warlock_login+']:', error); // Print the error if one occurred
    }
    if (response && response.statusCode === 200) {
      if (body.indexOf('No player by the name') != -1) {
        console.log('checkWarlockActivity', 'response', warlock_login, 'not found');
        removeWarlock(warlock_id);
      } else if (body.indexOf('Ready in battles') != -1) {
        console.log('checkWarlockActivity', 'response', warlock_login, 'ready in battles');
        alertWarlock(warlock_id, parseBattles(body), parseLastActivity(body));
      }
    } else {
      console.log('error['+warlock_login+']:', response);
    }
    if (!not_in_cycle) {
      setTimeout(checkWarlock, g_check_delay);
    }
  });
  
  return true;
}

function checkWarlock(not_in_cycle) {
  console.log('checkWarlock', g_check_delay, g_curr_warlock_index, garr_warlock_id.length);
  if (!prepareWarlockIndex()) {
    if (!not_in_cycle) {
      setTimeout(checkWarlock, g_check_delay);
    }
    return;
  }
  if (!((g_curr_warlock_index >= 0) && (g_curr_warlock_index < garr_warlock_id.length))) {
    console.log('checkWarlock', 'wrong index', g_curr_warlock_index, garr_warlock_id.length);
    if (!not_in_cycle) {
      setTimeout(checkWarlock, g_check_delay);
    }
    return;
  }
  var warlock_id = garr_warlock_id[g_curr_warlock_index];
  if (!warlock_id) {
    console.log('checkWarlock', 'wrong garr_warlock_id', g_curr_warlock_index, warlock_id);
    if (!not_in_cycle) {
      setTimeout(checkWarlock, g_check_delay);
    }
    return;
  }
  
  var res = checkWarlockActivity(warlock_id, not_in_cycle);
  
  if (!res && !not_in_cycle) {
    setTimeout(checkWarlock, g_check_delay);
  }
}

loadDBData();

// WEB App

var privateKey  = fs.readFileSync('./ssl/privkey.pem', 'utf8');
var certificate = fs.readFileSync('./ssl/fullchain.pem', 'utf8');

var credentials = {key: privateKey, cert: certificate};

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// your express configuration here
var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

httpServer.listen(4887);
httpsServer.listen(4888);

/*var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((4888));
*/


// Facebook Webhook
// Used for verification
app.get("/webhook", function (req, res) {
   console.log('get webhook');
    if (req.query["hub.verify_token"] === '20190223_check') {
        console.log("Verified webhook");
        res.status(200).send(req.query["hub.challenge"]);
    } else {
        console.error("Verification failed. The tokens do not match. ["+req.query["hub.verify_token"]+"]");
        res.sendStatus(403);
    }
});

// All callbacks for Messenger will be POST-ed here
app.post("/webhook", function (req, res) {
    // Make sure this is a page subscription
    console.log("/webhook", req.body.object, req.body.entry.length);
    if (req.body.object == "page") {
        for (var i = 0, Ln = req.body.entry.length; i < Ln; ++i) {
          if (req.body.entry[i].messaging) {
            for (var j = 0, LnJ = req.body.entry[i].messaging.length; j < LnJ; ++j) {
              if (req.body.entry[i].messaging[j].message) {
                processMessage(req.body.entry[i].messaging[j]);
              } else if (req.body.entry[i].messaging[j].read) {
                processMessageRead(req.body.entry[i].messaging[j]);
              }
            }
          }
        }
    }
    res.sendStatus(200);
});

function processPostback(event) {
    var senderId = event.sender.id;
    var payload = event.postback.payload;

    if (payload === "Greeting") {
        // Get user's first name from the User Profile API
        // and include it in the greeting
        sendMessage(senderId, {text: 'Hi there, use command "watch warlock_login" to receive alert about warlock\'s battle ready'});
    } else if (payload === "Correct") {
        sendMessage(senderId, {text: "great"});
    } else if (payload === "Incorrect") {
        sendMessage(senderId, {text: "Oops!"});
    }
}

function processMessageRead(event) {
  console.log('processMessageRead', JSON.stringify(event));
  var senderId = event.sender.id;
  console.log("fb user: " + senderId + " ready the message");
  var user_id = garr_fbuid[getObjectCode(senderId, 'f')];
  if (!user_id) {
    console.log("User not found by fb user: " + senderId);
    return;
  }
  if (!garr_user[getObjectCode(user_id)]) {
    console.log('User ['+user_id+'] not found by fb user: ' + senderId);
    return;
  }
  garr_user[getObjectCode(user_id)].delay_level = 0;
  updateUser(garr_user[getObjectCode(user_id)]);
}

function processMessage(event) {
  console.log('processMessage2', JSON.stringify(event));
  var message = event.message;
  var senderId = event.sender.id;
  console.log("Received message from senderId: " + senderId);
  console.log("Message is: " + JSON.stringify(message));
  var user = storeUser(senderId);
  console.log("user", user);

  // You may get a text or attachment but not both
  if (message.text) {
      var arr = message.text.toLowerCase().trim().split(' ');
      if (arr[0] === 'sleep') {
        garr_user[getObjectCode(user.uid)].sleep = 1;
        updateUser(garr_user[getObjectCode(user.uid)]);
        sendMessage(senderId, {text: 'Good night!\nAlert off\nType "wake" to switch on'});
      } else if (arr[0] === 'wake') {
        garr_user[getObjectCode(user.uid)].sleep = 0;
        garr_user[getObjectCode(user.uid)].delay_level = 0;
        updateUser(garr_user[getObjectCode(user.uid)]);
        sendMessage(senderId, {text: 'Good morning!\nAlerts on\nType "sleep" to switch off'});
      } else if (arr[0] === 'watch') {
        if (arr.length < 2) {
          sendMessage(senderId, {text: 'Command WATCH has following syntax "watch warlock_login" please add warlock login to your request'});
          return;
        }
        storeWatch(user.uid, arr[1]);
        sendMessage(senderId, {text: 'OK, you will be receive alert about ' + arr[1].toUpperCase() + ' battles ready'});
      } else if (arr[0] === 'stop') {
        if ((arr[0] === 'watch') || (arr.length < 3)) {
          sendMessage(senderId, {text: 'Command STOP has following syntax "stop watch warlock_login" please fix your request'});
          return;
        }
        stopWatch(user.uid, arr[2]);
        sendMessage(senderId, {text: 'OK, you will not receive alert about ' + arr[1].toUpperCase() + ' battles'});
      } else if ((arr[0] === 'help') || (arr[0] === 'menu')) {
        sendMessage(senderId, {text: 'Hi, I am Spellcaster Notificator, bot that alert you when your battle need action.\nFirst you should register on site https://games.ravenblack.net/newplayer and read game rules ;) https://games.ravenblack.net/rules/0/index.html\nOk now you can receive notification about battles that wait for your action\nJust type command "watch your_warlock_login" and alert appears in your messenger each time when battle ready\nAlso use command "sleep" and "wake" to switch off/on notifications'});
      } else if (!user.hint_show) {
        sendMessage(senderId, {text: 'Sorry, I don\'t understand you request, try command "watch warlock_login" or help command or wait for human operator response (this message show only once, all another unknown commands will be sent to human operator)'});
        saveShowAlertToUser(user.uid);
      }
  }/* else if (message.attachments) {
      sendMessage(senderId, {text: 'Sorry, I don\'t understand attachments, try command "watch warlock_login" or help or wait for human operator response'});
  }*/
}

function addUser(user_id, fb_uid) {
  console.log('addUser', user_id, fb_uid);
  mysql_db.query('INSERT INTO sn_user(user_id, facebook_uid) VALUES(?, ?)', [user_id, fb_uid], 
    function (err, res) {
      if (err) {
        console.log('addUser', user_id, fb_uid, err.stack);
      } else {
        console.log('addUser', user_id, fb_uid, res[0]);
      }
    });
}

function updateUser(user) {
  console.log('updateUser', user);
  mysql_db.query('update sn_user set last_msg_date = ?, delay_level = ?, sleep = ? where user_id = ?', [user.last_msg_date, user.delay_level, user.sleep, user.uid], 
    function (err, res) {
      if (err) {
        console.log('updateUser', user.last_msg_date, user.delay_level, user.uid, err.stack);
      } else {
        console.log('updateUser', user.last_msg_date, user.delay_level, user.uid);
      }
    });
}

function saveShowAlertToUser(user_id){
  console.log('saveShowAlertToUser', user_id);
  garr_user[getObjectCode(user_id)].hint_show = 1;
  mysql_db.query('update sn_user set hint_show = 1 where user_id = ?', [user_id], 
    function (err, res) {
      if (err) {
        console.log('updateUser', user_id, err.stack);
      } else {
        console.log('updateUser', user_id);
      }
    });
}

function addWarlock(warlock_id, warlock_login) {
  console.log('addWarlock', warlock_id, warlock_login);
  mysql_db.query('INSERT INTO sn_warlock(warlock_id, login) VALUES(?, ?)', [warlock_id, warlock_login], 
    function (err, res) {
      if (err) {
        console.log('addWarlock', warlock_id, warlock_login, err.stack);
      } else {
        console.log('addWarlock', warlock_id, warlock_login, res[0]);
      }
    });
}

function addWarlockListener(warlock_id, user_id) {
  console.log('addWarlockListener', warlock_id, user_id);
  mysql_db.query('insert into sn_warlock_listener(user_id, warlock_id) select ?, ? where not exists(select 0 from sn_warlock_listener s where s.user_id = ? and s.warlock_id = ?)', 
           [user_id, warlock_id, user_id, warlock_id], 
    function (err, res) {
      if (err) {
        console.log('addWarlockListener', warlock_id, user_id, err.stack);
      } else {
        console.log('addWarlockListener', warlock_id, user_id, res[0]);
      }
    });
}

function removeWarlockListener(warlock_id, user_id) {
  console.log('removeWarlockListener', warlock_id, user_id);
  mysql_db.query('delete from sn_warlock_listener where user_id = ? and warlock_id = ?', [user_id, warlock_id], 
    function (err, res) {
      if (err) {
        console.log('removeWarlockListener', warlock_id, user_id, err.stack);
      } else {
        console.log('removeWarlockListener', warlock_id, user_id, 'OK');
      }
    });
}

function getUserIdByFBId(fb_uid) {
  var user_id = garr_fbuid[getObjectCode(fb_uid, 'f')];
  return user_id ? user_id : 0;
}

function storeUser(fb_uid) {
  var user_id = getUserIdByFBId(fb_uid);
  /*for(key in garr_user) {
    if (garr_user[key].fuid === fb_uid) {
      user_id = garr_user[key].uid;
      break;
    }
  }*/
  if (user_id) {
    console.log('storeWatch', 'found user by fb id', user_id);
  } else {
    user_id = getNextUserID();
    garr_fbuid[getObjectCode(fb_uid, 'f')] = user_id;
    addUser(user_id, fb_uid);
    garr_user[getObjectCode(user_id)] = {uid:user_id,fuid:fb_uid,hint_show:0};
    console.log('storeWatch', 'add user', user_id, getObjectCode(user_id), garr_user[getObjectCode(user_id)]);
  }
  return garr_user[getObjectCode(user_id)];
}

function getWarlockIdByLogin(warlock_login) {
  var warlock_id = 0;
  for(key in garr_warlock) {
    if (garr_warlock[key].login === warlock_login) { // both lower case
      warlock_id = garr_warlock[key].wid;
      break;
    }
  }
  return warlock_id;
}

function storeWatch(user_id, warlock_login) {
  console.log('storeWatch', user_id, warlock_login);
  var warlock_id = getWarlockIdByLogin(warlock_login);
  if (warlock_id) {
    console.log('storeWatch', 'found warlock by login', warlock_id, warlock_login);
  } else {
    warlock_id = getNextWarlockID();
    addWarlock(warlock_id, warlock_login);
    garr_warlock[getObjectCode(warlock_id, 'w')] = {wid:warlock_id,login:warlock_login,listener:[]};
    garr_warlock_id.push(warlock_id);
    console.log('storeWatch', 'add warlock', warlock_id, getObjectCode(warlock_id, 'w'), garr_warlock[getObjectCode(warlock_id, 'w')]);
  }
  if (garr_warlock[getObjectCode(warlock_id, 'w')].listener.indexOf(user_id) === -1) {
    garr_warlock[getObjectCode(warlock_id, 'w')].listener.push(user_id);
    addWarlockListener(warlock_id, user_id);
    console.log('storeWatch', 'add warlock listener', garr_warlock[getObjectCode(warlock_id, 'w')].listener);
  }
  checkWarlockActivity(warlock_id, true);
}

function stopWatch(user_id, warlock_login) {
  console.log('storeWatch', user_id, warlock_login);
  var warlock_id = getWarlockIdByLogin(warlock_login);
  if (!warlock_id) {
    console.log('stopWatch', 'not found warlock by login', warlock_login);
    return;
  }
  var idx = garr_warlock[getObjectCode(warlock_id, 'w')].listener.indexOf(user_id);
  if (idx === -1) {
    console.log('stopWatch', 'user not spy for warlock', user_id, warlock_login);
    return;
  }
  garr_warlock[getObjectCode(warlock_id, 'w')].listener.splice(idx, 1);
  removeWarlockListener(warlock_id, user_id);
  console.log('stopWatch', 'remove warlock listener', garr_warlock[getObjectCode(warlock_id, 'w')].listener);
}

// Server index page
app.get("/", function (req, res) {
  res.send("Notification about waiting battles on site <a href=\"https://games.ravenblack.net/\">https://games.ravenblack.net/</a><br>Facebook group: <a href=\"https://www.facebook.com/WarlocksDuel/\">https://www.facebook.com/WarlocksDuel/</a><br>Android app: <a href=\"https://play.google.com/store/apps/details?id=net.is.games.WarlocksDuel\">https://play.google.com/store/apps/details?id=net.is.games.WarlocksDuel</a><br>" + 
  "Statistic:<br>User: " + g_max_user_id + "<br>Warlock: " + g_max_warlock_id + "<br>Message: " + g_message_count + "<br>");
});

function getDelayByLevel(level) {
  return level * 5 * 60;
}

function checkUserDelay(user) {
  var ct = time(); // current time
  var lmt = user.last_msg_date; // last message sent time
  var delay = getDelayByLevel(user.delay_level); // delay in seconds
  console.log('checkUserDelay', ct, lmt, delay, user);
  return (user.sleep === 0) && (lmt + delay <= ct); 
}

function sendMessageToUser(user, message) {
    if (!checkUserDelay(user)) {
      return;
    }
    user.last_msg_date = time();
    ++user.delay_level;
    updateUser(user);
    sendMessage(user.fuid, message);
}

// sends message to user
function sendMessage(recipientId, message) {
    ++g_message_count;
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {access_token: 'EAAEradbunVUBADU51BLuAsNIW3HqP9OZBeNHKKqJit4UmVLv5SGBLuA6YDS1OBVAnAaIWEGF1HCjLv6aqggrDscKzCmVXwJT1uCI3HmzWljuqYO6kc5X0RcyQcztOFfc8QIe0lolqNkhSrJSwM5KkMd8IIssPhjX12KSED6L7amS9kQ9K'},
        method: "POST",
        json: {
            recipient: {id: recipientId},
            message: message,
        }
    }, function(error, response, body) {
        if (error) {
            console.log("Error sending message: " + response.error);
        }
        console.log('sendMessage', body);
    });
}

function time() {
  return Math.floor(Date.now() / 1000);
}