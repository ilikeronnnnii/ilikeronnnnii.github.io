/* ==========================================================================
   /js/music.js -- renders the frozen listening archive and drives the fake
   transport. Data comes from /js/archive.js (window.LISTENING_ARCHIVE);
   nothing here touches the network.
   ========================================================================== */
(function () {
  "use strict";

  var A = window.LISTENING_ARCHIVE;
  if (!A) return;

  var TRACK_MS = 8000; // the "re-enactment" speed: one track every 8 seconds
  var TICK_MS = 100;

  // ------------------------------------------------------------ helpers
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function num(n) {
    return Number(n).toLocaleString("en-US");
  }

  function clock(uts) {
    var d = new Date(uts * 1000);
    return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
  }

  function link(href, text, title) {
    var a = el("a", null, text);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    if (title) a.title = title;
    return a;
  }

  var MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // a little win98 progress meter for play counts
  function playsCell(plays, max) {
    var cell = el("td", "col-plays");
    var meter = el("span", "plays");
    var fill = el("i");
    fill.style.width = Math.max(3, Math.round((plays / max) * 100)) + "%";
    meter.appendChild(fill);
    cell.appendChild(meter);
    cell.appendChild(el("span", "plays-num", num(plays)));
    return cell;
  }

  // --------------------------------------------------------------- stats
  var statsHost = document.getElementById("stats");
  if (statsHost) {
    [
      [A.stats.scrobbles, "scrobbles", "media_player-0.png"],
      [A.stats.artists, "artists", "users-0.png"],
      [A.stats.tracks, "tracks", "cd_audio_cd-0.png"],
      [A.stats.albums, "albums", "directory_favorites-5.png"]
    ].forEach(function (row) {
      var tile = el("div", "stat");

      var icon = el("img", "stat-icon");
      icon.src = "/images/listening/icons/" + row[2];
      icon.width = 16;
      icon.height = 16;
      icon.alt = "";
      tile.appendChild(icon);

      var body = el("div", "stat-body");
      body.appendChild(el("span", "stat-value", num(row[0])));
      body.appendChild(el("span", "stat-label", row[1]));
      tile.appendChild(body);

      statsHost.appendChild(tile);
    });
  }

  // ------------------------------------------------------------- session
  // newest first, so row 01 is the last track the account ever scrobbled
  var sessionRows = document.getElementById("session-rows");
  var sessionSpan = document.getElementById("session-span");
  var session = A.session.slice().reverse();
  var oldest = session[session.length - 1].uts;
  var newest = session[0].uts;
  var minutes = Math.round((newest - oldest) / 60);

  if (sessionSpan) {
    var from = new Date(oldest * 1000);
    var to = new Date(newest * 1000);
    var days = from.getUTCDate() === to.getUTCDate()
      ? String(to.getUTCDate())
      : from.getUTCDate() + "\u2013" + to.getUTCDate();
    sessionSpan.textContent = "\u00b7 " + days + " " + MONTHS[to.getUTCMonth()] + " " + to.getUTCFullYear() +
      " \u00b7 " + Math.floor(minutes / 60) + "h " + pad2(minutes % 60) + "m";
  }

  if (sessionRows) {
    sessionRows.textContent = "";
    session.forEach(function (track, i) {
      var tr = el("tr");
      if (i % 2) tr.className = "alt";
      if (i === 0) tr.className = "is-last";

      tr.appendChild(el("td", "col-rank", pad2(i + 1)));

      var trackCell = el("td", "track-cell");
      trackCell.appendChild(link(track.u, track.t, track.t + " \u2014 " + track.a));
      if (i === 0) trackCell.appendChild(el("span", "chip", "last"));
      tr.appendChild(trackCell);

      tr.appendChild(el("td", null, track.a));
      tr.appendChild(el("td", "col-time", clock(track.uts)));
      sessionRows.appendChild(tr);
    });
  }

  // ------------------------------------------------------------- artists
  var artistRows = document.getElementById("artist-rows");
  if (artistRows) {
    artistRows.textContent = "";
    var topArtist = A.artists[0].plays;
    A.artists.forEach(function (artist, i) {
      var tr = el("tr");
      if (i % 2) tr.className = "alt";

      tr.appendChild(el("td", "col-rank", pad2(i + 1)));

      var nameCell = el("td");
      nameCell.appendChild(link(artist.url, artist.name));
      tr.appendChild(nameCell);

      tr.appendChild(playsCell(artist.plays, topArtist));
      artistRows.appendChild(tr);
    });
  }

  // -------------------------------------------------------------- tracks
  var trackRows = document.getElementById("track-rows");
  if (trackRows) {
    trackRows.textContent = "";
    var topTrack = A.tracks[0].plays;
    A.tracks.forEach(function (track, i) {
      var tr = el("tr");
      if (i % 2) tr.className = "alt";

      tr.appendChild(el("td", "col-rank", pad2(i + 1)));

      var nameCell = el("td");
      nameCell.appendChild(link(track.u, track.t));
      tr.appendChild(nameCell);

      tr.appendChild(el("td", null, track.a));
      tr.appendChild(playsCell(track.plays, topTrack));
      trackRows.appendChild(tr);
    });
  }

  var status = document.getElementById("status-counts");
  if (status) {
    status.textContent = A.artists.length + " artists \u00b7 " + session.length + " tracks \u00b7 " + A.albums.length + " albums";
  }

  // -------------------------------------------------------------- albums
  var shelf = document.getElementById("album-shelf");
  if (shelf) {
    A.albums.forEach(function (album) {
      var fig = el("figure", "album");
      var img = el("img");
      img.src = "/images/listening/" + album.art;
      img.alt = album.name + " — " + album.artist;
      img.loading = "lazy";
      img.width = 174;
      img.height = 174;
      fig.appendChild(img);

      var cap = el("figcaption", null, album.name);
      cap.appendChild(el("span", "album-plays", num(album.plays) + " plays"));
      fig.appendChild(cap);
      fig.title = album.name + " — " + album.artist + " · " + num(album.plays) + " plays";
      shelf.appendChild(fig);
    });
  }

})();
