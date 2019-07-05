function parseBattles(Data, Search) {
  var res_list = [];
  var idx1 = Data.indexOf(Search);
  if (idx1 === -1) {
    return res_list;
  }
  idx1 += Search.length;
  var idx2 = Data.indexOf("<TABLE", idx1);
  if (idx2 == -1) {
    return res_list;
  }
  idx2 += 7;
  var idx3 = Data.indexOf("</TABLE", idx2);
  if (idx3 == -1) {
    return res_list;
  }
  var idx4 = idx2;
  var battle_id;
  while((idx4 = Data.indexOf("HREF=\"/warlocks?num=", idx4)) != -1 && idx4 < idx3) {
      idx4 += 19;
      battle_id = "";
      while(++idx4 < idx3) {
          var a = Data.substr(idx4, 1);
          if ('0123456789'.indexOf(a) !== -1) {
              battle_id += '' + a;
          } else {
              res_list.push(battle_id);
              break;
          }
      }
  }
  
  return res_list;
}

var str = `<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<HTML>
<HEAD>
<meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">
<META NAME="description" content="Warlocks - a free web-based game of magical duelling. Players try to destroy their opponents while defending themselves. Based on Waving Hands / Spellcaster / Firetop Mountain.">
<META NAME="keywords" content="Warlocks, spell, spellcasting, magic, free web-based game, magical duel, Firetop Mountain, Spellcaster, Waving Hands, two player, multi, RavenBlack, fireball, finger of death">
<TITLE>RavenBlack Games - Player Info</TITLE>

<link rel="stylesheet" type="text/css" href="/style/ie.css">

</HEAD>
<BODY BGCOLOR="#000000" TEXT="#FFFFFF" LINK="#00FF00" VLINK="#00FF88" ALINK="#FFFFFF">
<TABLE WIDTH="100%" BORDER=0 CELLPADDING=0 CELLSPACING=0>
<TR><TD ALIGN=LEFT CLASS=transbg>

</TD>
<TD ALIGN=RIGHT class=transbg><A HREF="/logout">Log out Galbarad</A></TD></TR></TABLE>


<TABLE BORDER=0 WIDTH="100%" CELLPADDING=4 CELLSPACING=0>
<TR><TD ALIGN=LEFT VALIGN=MIDDLE CLASS=lightbg>
<TABLE BORDER=0 CELLSPACING=2 CELLPADDING=4><TR><TD WIDTH=100 ALIGN=CENTER>
<H2><A HREF="/rules/0/index.html">Rules</A></H2>
</TD><TD WIDTH=100 ALIGN=CENTER>
<H2><A HREF="/player">Status</A></H2>
</TD><TD WIDTH=100 ALIGN=CENTER>
<H2><A HREF="/challenges">Challenges</A></H2>
</TD><TD WIDTH=100 ALIGN=CENTER>
<H2><A HREF="/players">Players</A></H2>
</TD></TR></TABLE>
</TD><TD ALIGN=RIGHT VALIGN=MIDDLE CLASS=lightbg>
<H1><A HREF="/">RavenBlack Games</A></H1>
</TD></TR></TABLE>


<BR>
<CENTER><P>
<TABLE WIDTH="90%" BORDER=0 CELLPADDING=2 CELLSPACING=0><TR><TD BGCOLOR="#0000AA" ALIGN=CENTER COLSPAN=2 CLASS=lightbg>
Info for Zubrowka 



</TD></TR><TR><TD WIDTH="50%" ALIGN=RIGHT>Website:</TD><TD ALIGN=LEFT><A HREF="http://www.ricardoramos.pl">http://www.ricardoramos.pl</A>

</TD></TR><TR><TD WIDTH="50%" VALIGN=TOP ALIGN=RIGHT>Preferences:</TD><TD ALIGN=LEFT>Prefers fast games.
</TD></TR><TR><TD ALIGN=RIGHT>Last Active:</TD><TD>7 minutes ago
</TD></TR></TABLE>

<BR><TABLE WIDTH="60%"><TR><TD CLASS=lightbg ALIGN=CENTER>Send a message to Zubrowka</TD></TR><FORM ACTION="/sendmess" METHOD="POST"><TR><TD>Message: <INPUT TYPE=HIDDEN NAME=rcpt VALUE=2566><INPUT TYPE=TEXT SIZE=60 MAXLENGTH=255 NAME=message><BR><INPUT TYPE=SUBMIT CLASS=button VALUE=Send></TD></TR></FORM></TABLE>Note: Sending another message will overwrite your previous message to Zubrowka which read:</B><BR><I>great) welcome in game)</I>
</CENTER>
<CENTER><TABLE WIDTH="70%" BORDER=0 CELLPADDING=2 CELLSPACING=0>
<TR><TD ALIGN=CENTER COLSPAN=2 CLASS=lightbg>Warlocks</TD></TR>
<TR><TD WIDTH="50%" ALIGN=RIGHT>Played:</TD><TD>0</TD></TR>
<TR><TD ALIGN=RIGHT>Won:</TD><TD>0</TD></TR>
<TR><TD ALIGN=RIGHT>Died:</TD><TD>0</TD></TR>
<TR><TD ALIGN=RIGHT>Ladder Score:</TD><TD>0</TD></TR>
<TR><TD ALIGN=RIGHT>Melee Score:</TD><TD>0</TD></TR>
<TR><TD ALIGN=RIGHT>Elo:</TD><TD>1500</TD></TR>
<TR><TD ALIGN=RIGHT VALIGN=TOP>Ready in battles:</TD><TD><TABLE CELLPADDING=0 CELLSPACING=0><TR ALIGN=RIGHT><TD><A HREF="/warlocks?num=84849">84849</A>&nbsp;</TD></TR></TABLE></TD></TR>
<TR><TD ALIGN=RIGHT VALIGN=TOP>Finished battles:</TD><TD><TABLE CELLPADDING=0 CELLSPACING=0><TR ALIGN=RIGHT><TD><A HREF="/warlocks?num=84822&full=1">84822</A>&nbsp;</TD><TD><A HREF="/warlocks?num=84821&full=1">84821</A>&nbsp;</TD><TD><A HREF="/warlocks?num=84842&full=1">84842</A>&nbsp;</TD><TD><A HREF="/warlocks?num=84841&full=1">84841</A>&nbsp;</TD><TD><A HREF="/warlocks?num=84844&full=1">84844</A>&nbsp;</TD><TD><A HREF="/warlocks?num=84845&full=1">84845</A>&nbsp;</TD></TR><TR ALIGN=RIGHT><TD><A HREF="/warlocks?num=84846&full=1">84846</A>&nbsp;</TD><TD><A HREF="/warlocks?num=84843&full=1">84843</A>&nbsp;</TD><TD><A HREF="/warlocks?num=84847&full=1">84847</A>&nbsp;</TD><TD><A HREF="/warlocks?num=84848&full=1">84848</A>&nbsp;</TD><TD><A HREF="/warlocks?num=84850&full=1">84850</A>&nbsp;</TD></TR></TABLE></TD></TR>

 </TABLE></CENTER><TABLE BORDER=0><TR><TD></TD></TR></TABLE></BODY>
</HTML>

`;

console.log(parseBattles(str, 'Finished battles:'));