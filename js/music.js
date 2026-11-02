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

  // -------------------------------------------------------------- stickers
  // a tiny elastic-square-billiards sim: stickers fly, bounce off the walls of
  // the profile block and off each other, and pass behind the avatar/name/link
  var wall = document.getElementById("sticker-wall");
  if (wall && window.STICKERS) {
    var compact = window.matchMedia("(max-width: 760px)").matches;
    var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var files = compact ? window.STICKERS.slice(0, 18) : window.STICKERS;
    var bodies = [];
    var raf = null;
    var last = 0;

    files.forEach(function (file) {
      var sticker = el("span", "sticker");
      var img = el("img");
      img.src = "/images/listening/tiny/" + file;
      img.alt = "";
      img.decoding = "async";
      img.addEventListener("error", function () {
        sticker.remove();
      });
      sticker.appendChild(img);
      wall.appendChild(sticker);
    });

    function measure() {
      bodies = [];
      var w = wall.clientWidth, h = wall.clientHeight;
      [].forEach.call(wall.children, function (sticker, i) {
        var bw = sticker.offsetWidth || 0;
        var bh = sticker.offsetHeight || 0;
        if (bw < 4 || bh < 4) return;
        var speed = compact ? 90 : 155;
        var dir = i % 2 ? 1 : -1;
        bodies.push({
          el: sticker,
          w: bw,
          h: bh,
          x: Math.random() * Math.max(1, w - bw),
          y: Math.random() * Math.max(1, h - bh),
          vx: dir * (speed + Math.random() * speed * 1.25),
          vy: (Math.random() < 0.5 ? -1 : 1) * (speed + Math.random() * speed * 1.25),
          a: ((i * 37) % 21) - 10,
          va: ((i % 2 ? 1 : -1) * (30 + (i * 7) % 90))
        });
      });
    }

    function step(ts) {
      if (!last) last = ts;
      var dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      var w = wall.clientWidth, h = wall.clientHeight;
      var i, b, other;

      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.a += b.va * dt;
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }
        if (b.x + b.w > w) { b.x = w - b.w; b.vx = -Math.abs(b.vx); }
        if (b.y + b.h > h) { b.y = h - b.h; b.vy = -Math.abs(b.vy); }
      }

      // pairwise collisions (43 bodies -> ~900 checks a frame, cheap)
      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        for (var k = i + 1; k < bodies.length; k++) {
          other = bodies[k];
          var dx = (other.x + other.w / 2) - (b.x + b.w / 2);
          var dy = (other.y + other.h / 2) - (b.y + b.h / 2);
          var rad = (Math.min(b.w, b.h) + Math.min(other.w, other.h)) * 0.34;
          var d2 = dx * dx + dy * dy;
          if (d2 === 0 || d2 > rad * rad) continue;

          var d = Math.sqrt(d2);
          var nx = dx / d;
          var ny = dy / d;
          var bv = b.vx * nx + b.vy * ny;
          var ov = other.vx * nx + other.vy * ny;
          if (bv - ov <= 0) continue;   // already separating

          // equal-mass elastic exchange along the contact normal
          var swap = (ov - bv);
          b.vx += swap * nx;
          b.vy += swap * ny;
          other.vx -= swap * nx;
          other.vy -= swap * ny;

          var push = (rad - d) / 2;
          b.x -= nx * push;
          b.y -= ny * push;
          other.x += nx * push;
          other.y += ny * push;
        }
      }

      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        b.el.style.transform = "translate3d(" + b.x.toFixed(1) + "px," +
          b.y.toFixed(1) + "px,0) rotate(" + b.a.toFixed(1) + "deg)";
      }

      raf = requestAnimationFrame(step);
    }

    function kick() {
      if (still) {
        // no motion: just lay them out once
        measure();
        bodies.forEach(function (b) {
          b.el.style.transform = "translate3d(" + b.x.toFixed(0) + "px," +
            b.y.toFixed(0) + "px,0) rotate(" + b.a.toFixed(0) + "deg)";
        });
        return;
      }
      measure();
      if (raf) cancelAnimationFrame(raf);
      last = 0;
      raf = requestAnimationFrame(step);
    }

    // images decide their own width, so wait for them before measuring
    window.addEventListener("load", function () {
      setTimeout(kick, 250);
    });

    var rt = null;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(kick, 250);
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden && raf) {
        cancelAnimationFrame(raf);
        raf = null;
      } else if (!document.hidden && !raf && !still) {
        last = 0;
        raf = requestAnimationFrame(step);
      }
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
