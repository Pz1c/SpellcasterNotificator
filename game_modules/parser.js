function parseChallengeTitle(title, battle) {
  var idx1 = 0, idx2;
  while ((idx1 = title.indexOf('HREF="/player/', idx1)) != -1) {
    idx1 += 14;
    idx2 = title.indexOf('.html', idx1);
    var warlock = title.substr(idx1, idx2 - idx1);
    battle.warlocks.push(warlock);
    ++battle.count;
  }
  idx1 = title.indexOf('Need ');
  if (idx1 === -1) {
    ++battle.count;
  } else {
    idx1 += 5;
    idx2 = title.indexOf(' ', idx1);
    var cnt = title.substr(idx1, idx2 - idx1) * 1;
    battle.count += cnt;
  }
}

function parseChallengeLevel(level, battle) {
  battle.fast = level.indexOf('Fast') != -1;
  if (level.indexOf('V.Friendly') != -1) {
    battle.level = 0;
  } else if (level.indexOf('Friendly') != -1) {
    battle.level = 1;
  } else {
    battle.level = 2;
  }
}

function parseChallengeDesc(description, battle) {
  battle.bot_allowed = description.indexOf('NO BOT') === -1;
  battle.only_bot_allowed = description.indexOf('TRANING BOT ONLY') !== -1;
  battle.is_bot = description.indexOf('Training Battle with AI Player') !== -1;
  battle.desc = description;
}

function parseChallengeAccept(accept, battle) {
  battle.battle_id = 0;
  if (accept.indexOf('>Accept</A>') === -1) {
    return;
  }
  var idx1 = accept.indexOf('num=');
  if (idx1 === -1) {
    return;
  }
  idx1 += 4;
  var idx2 = accept.indexOf('"', idx1);
  battle.battle_id = accept.substr(idx1, idx2 - idx1);
}

function parseChallenge(row) {
  console.log('parseChallenge', row);
  var res = {warlocks:[],count:0,level:0,desc:'',fast:false,bot_allowed:true,only_bot_allowed:false,is_bot:false};
  var arr = row.split('</TD>');
  parseChallengeTitle(arr[0].replace('<TD>', ''), res);
  parseChallengeLevel(arr[1].replace('<TD>', ''), res);
  parseChallengeDesc(arr[2].replace('<TD>', ''), res);
  parseChallengeAccept(arr[3].replace('<TD>', ''), res);
  
  console.log('parseChallenge', res);
  return res;
}

function printBattleLevel(battle) {
  switch(battle.level) {
    case 0: return "V.Friendly";
    case 1: return "Friendly";
    case 2: return battle.count > 2 ? "Melee" : "Ladder";
  }
}

function prepareMessageAboutNewBattle(battle) {
  var res = "New " + battle.fast ? "Fast " : "";
  res += printBattleLevel(battle) + " battle [" + battle.battle_id + "] for " + battle.count + "!\n";
  res += "Participants: " + battle.warlocks.join(",") + "\n" + battle.desc;  
  return res;
}

function parseChallenges(body, max_battle_id) {
  var res = [];
  var idx1 = body.indexOf('<TD CLASS=darkbg>Description</TD>');
  if (idx1 === -1) {
    return res;
  }
  idx1 = body.indexOf('<TR><TD>', idx1);
  var idx2 = body.indexOf('</TABLE>', idx1);
  var arr_table = body.substr(idx1, idx2 - idx1).split('</TR>');
  for (var i = 0, Ln = arr_table.length; i < Ln; ++i) {
    if (arr_table[i].indexOf('<TD>') === -1) {
      continue;
    }
    var challenge = parseChallenge(arr_table[i].replace('<TR>', ''));
    if (challenge.is_bot || challenge.only_bot_allowed || (challenge.battle_id <= max_battle_id)) {
      continue;
    }
    challenge.msg = prepareMessageAboutNewBattle(challenge);
    res.push(challenge);
  }
  
  return res;
}

exports.parseChallenges = parseChallenges;