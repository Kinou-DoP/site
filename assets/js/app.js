// kinou — logique du site. Les donnees viennent des fichiers JSON de DATA_BASE.
(function () {
  // Donnees JSON : publiees par l'admin (repo kinou-agency/admin), lues ici par le site officiel et la beta.
  // (via /api/data du site, qui les lit dans GitHub ; en local, on passe par la beta)
  var DATA_BASE = /(^|\.)netlify\.app$|(^|\.)kinou\.fr$/.test(location.hostname) ? "/api/data/" : "https://beta--kinou-test.netlify.app/api/data/";
  function getJSON(path) {
    return fetch(DATA_BASE + path).then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + DATA_BASE + path);
      return r.json();
    });
  }

  // ---------- Accueil : slideshow (data/home.json) ----------
  function initHome(PROJECTS, DURATION) {

    var wrap = document.getElementById("slides"), bars = document.getElementById("bars");
    var cap = document.getElementById("caption"), film = document.getElementById("film"),
        legend = document.getElementById("legend"), name = document.getElementById("name");
    var slides = [], buttons = [], cur = -1, timer = null, active = true;

    PROJECTS.forEach(function (p, i) {
      var s = document.createElement("div");
      s.className = "slide";
      s.style.setProperty("--h", p.h);
      if (p.zoom > 1) s.style.setProperty("--z", p.zoom); // recadrage réglé dans l'admin (enlève les bandes noires)
      var inner = document.createElement("div"); inner.className = "in"; s.appendChild(inner);
      if (p.video) {
        var v = document.createElement("video");
        v.muted = true; v.playsInline = true; v.preload = "none"; v.dataset.src = p.video;
        inner.appendChild(v);
      }
      wrap.appendChild(s); slides.push(s);
      var b = document.createElement("button");
      b.setAttribute("aria-label", p.dps.map(function (d) { return d.name; }).join(" & ") + " — " + p.film);
      b.addEventListener("click", function () { go(i); });
      bars.appendChild(b); buttons.push(b);
    });

    // Garde le nom sur une seule ligne : reduit la taille si l'espace manque.
    function fit() {
      var nm = name.querySelector(".ns");
      if (!nm) return;
      name.style.fontSize = "";
      var mobile = window.innerWidth <= 700;
      var avail = mobile ? window.innerWidth - 48 : window.innerWidth - 64 - cap.offsetWidth - 32;
      var size = parseFloat(getComputedStyle(name).fontSize);
      while (nm.offsetWidth > avail && size > 14) { size -= 2; name.style.fontSize = size + "px"; }
    }
    window.addEventListener("resize", fit);

    function next() { go(cur + 1); }
    // timed : le projet en cours avance au minuteur (pas de video, ou video en erreur) depuis timedAt.
    var timed = false, timedAt = 0;
    function later() { clearTimeout(timer); timer = setTimeout(next, DURATION); timed = true; timedAt = performance.now(); }
    // Avancement du projet en cours (0 a 1), affiche par le trait blanc de sa barre.
    (function tick() {
      if (active && cur >= 0) {
        var v = slides[cur].querySelector("video"), p = 0;
        if (timed) p = (performance.now() - timedAt) / DURATION;
        else if (v && v.duration) p = v.currentTime / v.duration;
        buttons[cur].style.setProperty("--p", Math.min(1, p).toFixed(4));
      }
      requestAnimationFrame(tick);
    })();

    function go(i) {
      i = (i + PROJECTS.length) % PROJECTS.length;
      clearTimeout(timer);
      if (cur >= 0) {
        var prev = slides[cur];
        slides.forEach(function (s) { if (s !== prev) s.classList.remove("leaving"); });
        prev.classList.remove("on"); prev.classList.add("leaving"); buttons[cur].classList.remove("on");
        setTimeout(function () { prev.classList.remove("leaving"); }, 1300);
        var old = slides[cur].querySelector("video");
        if (old) { old.pause(); }
      }
      cur = i; timed = false;
      buttons[i].style.setProperty("--p", 0);
      var p = PROJECTS[i];
      if (window.Site && Site.prefetch) p.dps.forEach(function (d) { if (d.slug) Site.prefetch(d.slug); }); // vignettes pretes si on clique sur le nom
      slides[i].classList.add("on"); buttons[i].classList.add("on");

      cap.classList.remove("show"); name.classList.remove("show");
      setTimeout(function () {
        film.textContent = p.film; film.className = p.song ? "big" : ""; document.getElementById("song").textContent = p.song || ""; legend.textContent = p.legend;
        // Un lien par chef op (plusieurs chefs op sur un même projet : « Nom & Nom »).
        name.textContent = "";
        var ns = document.createElement("span"); ns.className = "ns"; name.appendChild(ns);
        p.dps.forEach(function (d, k) {
          if (k) { var amp = document.createElement("span"); amp.className = "amp"; amp.textContent = " & "; ns.appendChild(amp); }
          var parts = d.name.split(","), main = parts[0].trim(), tags = parts.slice(1).join(", ").trim();
          var a = document.createElement("a"); a.href = "#" + d.slug; a.dataset.slug = d.slug; a.dataset.name = d.name;
          var nm = document.createElement("span"); nm.className = "n"; nm.textContent = main; a.appendChild(nm);
          if (tags) { var tg = document.createElement("span"); tg.className = "tags"; tg.textContent = tags; a.appendChild(tg); }
          if (!d.slug) a.removeAttribute("href");
          ns.appendChild(a);
        });
        fit();
        cap.classList.add("show"); name.classList.add("show");
      }, 550);

      var v = slides[i].querySelector("video");
      if (v) {
        if (!v.src) v.src = v.dataset.src;
        v.currentTime = 0;
        v.onended = next;
        v.onerror = later;
        var pr = v.play(); if (pr && pr.catch) pr.catch(later);
      } else { later(); }
    }

    document.addEventListener("keydown", function (e) {
      if (!active) return;
      if (e.key === "ArrowRight") go(cur + 1);
      if (e.key === "ArrowLeft") go(cur - 1);
    });
    // Molette / trackpad : un geste = un projet. L'inertie du trackpad (valeurs qui decroissent)
    // est ignoree ; un nouveau geste est reconnu a une pause ou a une reprise d'elan (valeur qui remonte).
    var wheelSum = 0, wheelLast = 0, wheelAbs = 0, wheelUntil = 0;
    window.addEventListener("wheel", function (e) {
      if (!active) return;
      var d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      var now = Date.now(), quiet = now - wheelLast > 160, rising = Math.abs(d) > wheelAbs * 1.5 + 4;
      wheelLast = now; wheelAbs = Math.abs(d);
      if (wheelUntil) {
        if (now < wheelUntil || !(quiet || rising)) return; // transition en cours, ou fin d'inertie du meme geste
        wheelUntil = 0; wheelSum = 0;
      }
      if (quiet) wheelSum = 0;
      wheelSum += d;
      if (Math.abs(wheelSum) > 40) { go(cur + (wheelSum > 0 ? 1 : -1)); wheelSum = 0; wheelUntil = now + 300; }
    }, { passive: true });
    // Glisser (téléphone) : vers la gauche ou vers le haut = projet suivant ; vers la droite ou le bas = précédent.
    var x0 = null, y0 = null;
    document.addEventListener("touchstart", function (e) {
      if (!active || document.body.classList.contains("menu-on")) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = y0 = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 50) return;
      if (Math.abs(dx) >= Math.abs(dy)) go(cur + (dx < 0 ? 1 : -1)); else go(cur + (dy < 0 ? 1 : -1));
    });

    // Les textes du bas apparaissent en fondu quand le curseur s'approche du bas de l'ecran.
    if (window.matchMedia("(hover: hover)").matches) {
      var root = document.documentElement;
      document.addEventListener("mousemove", function (e) {
        var H = window.innerHeight, d = H - e.clientY, start = H * 0.45, end = H * 0.15;
        var n = Math.max(0, Math.min(1, (start - d) / (start - end)));
        root.style.setProperty("--near", n.toFixed(3));
      });
      root.addEventListener("mouseleave", function () { root.style.setProperty("--near", 0); });
    }
    name.addEventListener("click", function (e) {
      var a = e.target.closest("a"); if (!a) return;
      e.preventDefault(); if (active && window.Site && a.dataset.slug) Site.fromHome(PROJECTS[cur], a);
    });
    window.HomeAPI = {
      pause: function () { active = false; clearTimeout(timer); var v = slides[cur].querySelector("video"); if (v) v.pause(); },
      resume: function () { if (active) return; active = true; var v = slides[cur].querySelector("video"); if (v && v.src) { var pr = v.play(); if (pr && pr.catch) pr.catch(later); v.onended = next; } else later(); },
      videoEl: function () { return slides[cur].querySelector("video"); }
    };
    go(Math.floor(Math.random() * PROJECTS.length)); // on arrive sur un film au hasard, puis l'ordre de la bande
  }

  // ---------- Liste des DPs + page DP (template unique) ----------
  function initSite(DPS) {
    // Liste des DPs (data/dps/index.json), meme balisage que le prototype.
    var ul = document.querySelector("main ul");
    DPS.forEach(function (d) {
      var li = document.createElement("li"), a = document.createElement("a");
      a.setAttribute("href", "#" + d.slug); a.dataset.view = d.slug; a.dataset.img = d.img || "images/" + d.slug + ".jpg";
      a.textContent = d.name;
      a.addEventListener("mouseenter", function () { loadDP(d.slug); }); // precharge la fiche
      li.appendChild(a); ul.appendChild(li);
    });
    // Dossier et extension des images : une image par technicien,
    // nommee comme la fin de son lien (ex. images/guillaume-adrey-cinematographer.jpg).
    // Pour une image specifique, ajouter data-img="chemin/image.jpg" sur le lien.
    var BASE = "images/", EXT = ".jpg";
    var bg = document.getElementById("bg"), cache = {};

    function src(a) {
      return a.dataset.img || BASE + a.getAttribute("href").replace(/\/+$/, "").split("/").pop() + EXT;
    }
    function showBg(a) { // (nommee "show" dans le prototype : ecrasee par show(t) plus bas)
      var u = src(a);
      var im = cache[u];
      if (!im) { im = cache[u] = new Image(); im.src = u; }
      function apply(u) {
        if (a.matches(":hover") || a === document.activeElement) {
          bg.style.backgroundImage = 'linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),url("' + u + '")';
          bg.style.opacity = 1;
        }
      }
      if (im.complete && im.naturalWidth) apply(u);
      else if (!im.complete) im.addEventListener("load", function () { apply(u); }); // pas d'image : pas de fond
    }
    // Fond video : extrait (snippet Slate) du premier film FEATURED du chef op, s'il a une fiche.
    var bgvid = document.getElementById("bgvid");
    function showBgVideo(a) {
      var slug = a.dataset.view;
      warmThumbs(slug);
      loadDP(slug).then(function (d) {
        if (!(a.matches(":hover") || a === document.activeElement)) return;
        var f = d && (WORK[slug] || []).filter(function (p) { return p.f && p.video; }).sort(function (x, y) { return (x.fo || 0) - (y.fo || 0); })[0];
        if (!f) { showBg(a); return; } // pas de fiche ou pas d'extrait : image s'il y en a une
        if (bgvid.dataset.src !== f.video) { bgvid.src = f.video; bgvid.dataset.src = f.video; }
        bgvid.style.setProperty("--z", f.zoom > 1 ? f.zoom : 1);
        try { bgvid.currentTime = 0; } catch (e) {}
        bgvid.onplaying = function () { if (a.matches(":hover") || a === document.activeElement) bgvid.classList.add("on"); };
        var pr = bgvid.play(); if (pr && pr.catch) pr.catch(function () {});
      });
    }
    function hide() { bg.style.opacity = 0; bgvid.classList.remove("on"); bgvid.onplaying = null; bgvid.pause(); }

    document.querySelectorAll("li a").forEach(function (a) {
      a.addEventListener("mouseenter", function () { showBgVideo(a); });
      a.addEventListener("focus", function () { showBgVideo(a); });
      a.addEventListener("mouseleave", hide);
      a.addEventListener("blur", hide);
    });
  // Page d'un technicien : son nom quitte la colonne et devient un grand titre en haut a droite.
    var hero = document.getElementById("hero"), view = null, ANIM = 1000, EASE = "cubic-bezier(.77, 0, .18, 1)";
    function split(t) {
      var i = t.indexOf(",");
      return i < 0 ? { main: t, tags: "" } : { main: t.slice(0, i).trim(), tags: t.slice(i + 1).trim() };
    }
    function nameRect(a, main) {
      var rg = document.createRange();
      rg.setStart(a.firstChild, 0); rg.setEnd(a.firstChild, main.length);
      return rg.getBoundingClientRect();
    }
    function startTransform(r, f) {
      return "translate(" + (r.left - f.left) + "px," + (r.top - f.top) + "px) scale(" + (r.width / f.width) + ")";
    }
    function homeNameRect(a) { return (a ? a.querySelector(".n") : document.querySelector("#home .name .n")).getBoundingClientRect(); }
    // o = { text, slug, rect (position de depart du nom), from: "home" | "list", a (lien de la liste), film (projet de l'accueil) }
    function openView(o) {
      if (view) return;
      var parts = split(o.text);
      view = { o: o, main: parts.main };
      var r = o.rect;
      hero.textContent = ""; hero.classList.remove("ready");
      var n = document.createElement("span"); n.className = "n"; n.textContent = parts.main; hero.appendChild(n);
      if (parts.tags) { var tg = document.createElement("div"); tg.className = "tags"; tg.textContent = parts.tags; hero.appendChild(tg); }
      hero.style.transition = "none"; hero.style.transform = "none"; hero.style.opacity = 0;
      var f = n.getBoundingClientRect();
      hero.style.transform = o.instant ? "none" : startTransform(r, f);
      void hero.offsetWidth;
      document.documentElement.style.overflow = "hidden";
      document.body.classList.remove("closing");
      document.body.classList.add("viewing");
      hero.style.transition = o.instant ? "none" : "transform " + ANIM + "ms " + EASE + ", opacity .25s";
      hero.style.transform = "none"; hero.style.opacity = 1;
      try { history.replaceState(null, "", "#" + o.slug); } catch (e) {}
      hero.classList.add("ready");
      if (o.from === "home") HomeAPI.pause();
      openWork(o.slug, o.from === "home" ? o.film : null);
    }
    function closeView(instant) {
      if (!view) return;
      var o = view.o, rect = o.from === "home" ? homeNameRect() : nameRect(o.a, view.main);
      view = null;
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      var f = hero.querySelector(".n").getBoundingClientRect();
      hero.classList.remove("ready");
      document.body.classList.remove("viewing");
      projvid.pause(); pauseSnips();
      function done() {
        document.body.classList.remove("closing");
        document.documentElement.style.overflow = document.body.classList.contains("is-home") ? "hidden" : "";
      }
      if (o.from === "home") HomeAPI.resume();
      if (instant) { hero.style.transition = "opacity .2s"; hero.style.opacity = 0; done(); return; }
      document.body.classList.add("closing");
      hero.style.transition = "transform " + ANIM + "ms " + EASE + ", opacity .3s .7s";
      hero.style.transform = startTransform(rect, f);
      hero.style.opacity = 0;
      setTimeout(done, ANIM + 100);
    }
    // Feed selectif par technicien : fiches data/dps/<slug>.json, chargees a la demande.
    // f: true = fait partie des projets FEATURED (fo = rang) ; img: chemin d'une image de couverture (optionnel).
    var CATS = ["FEATURED", "BEAUTY", "TEXTURES", "FOOD", "COMEDY", "LIFESTYLE", "AUTOMOTIVE"];
    var WORK = {}, CATS_BY = {}, TEMPLATE = {}, loading = {};
    function loadDP(slug) {
      if (!loading[slug]) loading[slug] = getJSON("dps/" + slug + ".json").then(function (d) { register(d); live(d); return d; }, function () { return null; });
      return loading[slug];
    }
    // Fiche avec bundle Slate : la page s'affiche tout de suite avec la copie enregistree dans la fiche,
    // puis se met a jour sans bruit quand /api/dp/<slug> (lu sur Slate, cache 10 min) repond, si quelque chose a change.
    function live(d) {
      if (!d.bundle) return;
      fetch("/api/dp/" + d.slug).then(function (r) { if (!r.ok) throw r; return r.json(); }).then(function (s) {
        if (JSON.stringify(s.clips) === JSON.stringify(d.clips) && JSON.stringify(s.categories) === JSON.stringify(d.categories)) return;
        d.categories = s.categories; d.clips = s.clips; register(d);
        if (view && view.o.slug === d.slug && document.body.classList.contains("has-work") && !work.classList.contains("about-mode") && !player.classList.contains("on")) refreshWork(d.slug);
      }).catch(function () {});
    }
    // Reaffiche la page ouverte avec les clips a jour, en gardant l'onglet et la position.
    function refreshWork(slug) {
      var cat = curCat, top = work.scrollTop;
      buildTabs(slug);
      if ((CATS_BY[slug] || CATS).indexOf(cat) < 0) cat = "FEATURED";
      cats.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x.dataset.cat === cat); });
      render(slug, cat, 0); work.scrollTop = top;
    }
    // Vignettes Slate allegees par le service d'images de Netlify (site en ligne uniquement ;
    // l'URL Slate signee est transmise telle quelle).
    var IMG_CDN = /(^|\.)netlify\.app$|(^|\.)kinou\.fr$/.test(location.hostname);
    // Precharge les vignettes FEATURED d'un chef op (survol de son nom, slide d'accueil).
    var warmed = {};
    function warmThumbs(slug) {
      if (!IMG_CDN || warmed[slug]) return;
      warmed[slug] = true;
      loadDP(slug).then(function (d) {
        if (d) (WORK[slug] || []).forEach(function (p) { if (p.f && p.img) new Image().src = thumb(p.img, GW); });
      });
    }
    function warmAll(slug) {
      if (!IMG_CDN) return;
      var seen = {};
      (WORK[slug] || []).forEach(function (p) { if (p.img && !seen[p.img]) { seen[p.img] = true; new Image().src = thumb(p.img, GW); } });
    }
    // Largeur des vignettes selon l'ecran : nettes sur un ecran haute densite (Retina), legeres sinon.
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var GW = Math.min(1200, Math.max(600, Math.ceil(window.innerWidth / 3 * DPR / 200) * 200)); // galerie (3 colonnes)
    var FW = Math.min(1800, Math.max(1000, Math.ceil(Math.min(window.innerWidth, 1400) * DPR / 200) * 200)); // feed (1 colonne)
    function thumb(u, w) {
      return IMG_CDN && /^https:\/\/images\.slatecdn\.net\//.test(u) ? "/.netlify/images?url=" + encodeURIComponent(u) + "&w=" + w + "&q=80&fm=webp" : u;
    }
    // Fiche JSON -> format interne du prototype (WORK, CATS_BY, ABOUT).
    function register(d) {
      var hue = d.hue || 0;
      var ov = d.overrides || {}; // corrections par clip (cle = id Slate) : title, sub, hidden…
      WORK[d.slug] = (d.clips || []).filter(function (c) { return !(ov[c.slate] && ov[c.slate].hidden); }).map(function (c, i) {
        var p = {}; for (var k in c) p[k] = c[k];
        if (ov[c.slate]) for (k in ov[c.slate]) p[k] = ov[c.slate][k];
        if (d.open !== undefined && c.slate === d.open) p.open = true;
        p.f = !!c.featured; if (c.featuredOrder) p.fo = c.featuredOrder;
        if (p.h === undefined) p.h = (i * 47 + hue) % 360;
        return p;
      });
      if (d.categories) CATS_BY[d.slug] = d.categories;
      var a = d.about || {};
      // Portrait et CV (PDF) : chemins relatifs au dossier des fiches.
      ["img", "cv"].forEach(function (k) { if (a[k] && !/^(https?:|data:|\/)/.test(a[k])) a[k] = DATA_BASE + "dps/" + a[k]; });
      ABOUT[d.slug] = a;
      TEMPLATE[d.slug] = d.template || "default";
      return d;
    }
    var work = document.getElementById("work"), feed = document.getElementById("feed"), cats = document.getElementById("cats"), modes = document.getElementById("modes");
    // ABOUT par technicien : bio (un paragraphe par ligne) + liens CV, Instagram, Website. Rempli par register().
    var ABOUT = {};
    var about = document.getElementById("about"), aboutbg = document.getElementById("aboutbg");
    // Fond plein ecran du projet survole (ou selectionne par clic / tap). p.img = visuel du projet.
    var projbg = document.getElementById("projbg"), projvid = document.getElementById("projvid"), selCard = null;
    function bgFor(p, w) {
      if (p.img) return 'linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("' + thumb(p.img, w || GW) + '")';
      return "none"; // pas de fond colore provisoire
    }
    // Ignore les cartes masquees sous l'en-tete (zone du titre) quand on a defile.
    function inZone(e) { return e.clientY >= work.getBoundingClientRect().top; }
  // Lecteur par-dessus la galerie / le feed
    var player = document.getElementById("player"), pstage = document.getElementById("pstage"), pcap = document.getElementById("pcap");
    var ptitle = document.getElementById("ptitle"), pgal = document.getElementById("pgal"), plight = document.getElementById("plight");
    // Films de l'onglet affiché (ordre de la page) : flèches ‹ › du lecteur pour passer au précédent / suivant.
    var playList = [], playIdx = -1;
    var pprev = document.getElementById("pprev"), pnext = document.getElementById("pnext");
    function stepPlayer(k) { if (playList.length > 1) openPlayer(playList[(playIdx + k + playList.length) % playList.length], true); }
    pprev.addEventListener("click", function () { stepPlayer(-1); });
    pnext.addEventListener("click", function () { stepPlayer(1); });
    // Bouton retour du téléphone / du navigateur : ferme l'image agrandie, puis le lecteur (pas la page).
    var pushed = 0, skipPop = 0;
    function pushStep() { history.pushState({ kinou: "player" }, ""); pushed++; }
    function popStep() { if (pushed > 0) { pushed--; skipPop++; history.back(); } }
    window.addEventListener("popstate", function () {
      if (skipPop) { skipPop--; return; }
      if (pushed > 0) pushed--;
      if (plight.classList.contains("on")) closeStill(true);
      else if (player.classList.contains("on")) closePlayer(true);
    });
    function openPlayer(p, keep) {
      if (!keep) {
        playList = [].map.call(feed.querySelectorAll(".card"), function (c) { return c._p; });
        if (!player.classList.contains("on")) pushStep();
      }
      playIdx = playList.indexOf(p);
      player.classList.toggle("has-nav", playList.length > 1 && playIdx > -1);
      projvid.pause(); pauseSnips();
      pstage.textContent = ""; pcap.textContent = "";
      pstage.style.backgroundImage = bgFor(p);
      var src = p.full || p.video; // film complet (avec son) si disponible, sinon l'extrait
      if (src) {
        var v = document.createElement("video");
        v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = "auto";
        if (p.img) v.poster = p.img;
        v.src = src; pstage.appendChild(v);
        var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
      } else if (p.img) {
        var im = document.createElement("img"); im.src = p.img; im.alt = p.title; pstage.appendChild(im);
      }
      ptitle.textContent = p.title;
      var s = document.createElement("p"); s.textContent = p.sub || p.cat; pcap.appendChild(s);
      buildStills(p);
      player.scrollTop = 0;
      player.classList.add("on");
    }
    // Galerie de stills (p.stills) sous les credits : chaque image apparait en arrivant a l'ecran ;
    // un clic l'agrandit (fleches : precedente / suivante).
    var stillsP = null, stillsIdx = 0;
    var seen = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { seen.unobserve(e.target); reveal(e.target); } });
    }, { root: player }) : null;
    function buildStills(p) {
      if (seen) seen.disconnect();
      pgal.textContent = ""; if (plight.classList.contains("on")) closeStill();
      stillsP = p.stills && p.stills.length ? p : null;
      player.classList.toggle("has-stills", !!stillsP);
      if (!stillsP) return;
      p.stills.forEach(function (u, i) {
        var b = document.createElement("button");
        b.dataset.src = thumb(u, GW);
        b.style.setProperty("--i", i % 3);
        b.setAttribute("aria-label", "Image " + (i + 1));
        b.addEventListener("click", function () { showStill(i); });
        pgal.appendChild(b);
        if (seen) seen.observe(b); else reveal(b);
      });
    }
    // L'image monte une fois chargee (pas de case vide qui apparait).
    function reveal(b) {
      var im = new Image();
      im.onload = im.onerror = function () { b.style.backgroundImage = 'url("' + b.dataset.src + '")'; b.classList.add("shown"); };
      im.src = b.dataset.src;
    }
    var plimg = document.getElementById("plimg");
    function showStill(i) {
      var n = stillsP.stills.length; i = (i + n) % n;
      plimg.textContent = "";
      var im = document.createElement("img"); im.src = stillsP.stills[i]; im.alt = stillsP.title; plimg.appendChild(im);
      if (!plight.classList.contains("on")) pushStep();
      plight.classList.toggle("multi", n > 1);
      stillsIdx = i; plight.classList.add("on");
    }
    function closeStill(fromBack) { plight.classList.remove("on"); if (!fromBack) popStep(); }
    plight.addEventListener("click", function (e) {
      var a = e.target.closest(".parrow");
      if (a) { showStill(stillsIdx + (a.id === "plnext" ? 1 : -1)); return; }
      closeStill();
    });
    // Image suivante : flèches du clavier, glisser sur téléphone, glisser à deux doigts sur le pavé tactile.
    var sx0 = null, swipeAt = 0;
    plight.addEventListener("touchstart", function (e) { sx0 = e.touches[0].clientX; }, { passive: true });
    plight.addEventListener("touchend", function (e) {
      if (sx0 === null) return;
      var dx = e.changedTouches[0].clientX - sx0; sx0 = null;
      if (Math.abs(dx) > 40) { swipeAt = Date.now(); showStill(stillsIdx + (dx < 0 ? 1 : -1)); }
    });
    plight.addEventListener("click", function (e) { if (Date.now() - swipeAt < 400) e.stopImmediatePropagation(); }, true);
    var lwSum = 0, lwLast = 0, lwUntil = 0;
    plight.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      var now = Date.now(); if (now - lwLast > 200) lwSum = 0; lwLast = now;
      if (now < lwUntil) return;
      lwSum += e.deltaX;
      if (Math.abs(lwSum) > 60) { showStill(stillsIdx + (lwSum > 0 ? 1 : -1)); lwSum = 0; lwUntil = now + 450; }
    }, { passive: false });
    document.addEventListener("keydown", function (e) {
      if (!player.classList.contains("on")) return;
      var k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!k) return;
      if (stillsP && plight.classList.contains("on")) showStill(stillsIdx + k); else stepPlayer(k);
    });
    function closePlayer(fromBack) {
      if (!player.classList.contains("on")) return;
      if (plight.classList.contains("on")) closeStill(fromBack);
      player.classList.remove("on");
      if (!fromBack) popStep();
      pstage.textContent = "";
      if (document.body.classList.contains("proj-on") && projvid.classList.contains("on")) { var pr = projvid.play(); if (pr && pr.catch) pr.catch(function () {}); }
    }
    player.addEventListener("click", function (e) { if (e.target === player || e.target === pgal || e.target.classList.contains("pin") || e.target.closest(".pclose")) closePlayer(); });
    function showProj(p, t) {
      projbg.style.backgroundImage = bgFor(p, 64); // fond flou : une toute petite image agrandie (leger a afficher)
      if (p.video && t !== undefined) {
        if (projvid.dataset.src !== p.video) { projvid.src = p.video; projvid.dataset.src = p.video; }
        if (t) { try { projvid.currentTime = t; } catch (e) {} }
        projvid.classList.add("on");
        var pr = projvid.play(); if (pr && pr.catch) pr.catch(function () {});
      } else { projvid.classList.remove("on"); projvid.pause(); }
      document.body.classList.add("proj-on");
    }
    function clearProj() { if (selCard) selCard.classList.remove("sel"); selCard = null; projvid.classList.remove("on"); projvid.pause(); document.body.classList.remove("proj-on"); }
    var mode = "gallery", curCat = "FEATURED";
    // Sur téléphone, toujours en feed (la grille est trop petite) : pas de choix d'affichage.
    var phone = window.matchMedia("(max-width: 700px)");
    function defMode() { return phone.matches ? "feed" : "gallery"; }
    phone.addEventListener && phone.addEventListener("change", function () {
      if (view && WORK[view.o.slug] && !work.classList.contains("about-mode")) { mode = defMode(); render(view.o.slug, curCat, 0); }
    });
    // Au survol d'un projet : la vignette joue un extrait video muet ; le fond plein ecran reste l'image fixe
    var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function snip(st, p, on) {
      var v = st.querySelector("video.snip");
      if (!on) {
        if (v) {
          v.pause(); v.classList.remove("on");
          // Libere la video (memoire, decodeur) une fois le fondu termine, si on n'est pas revenu dessus.
          v._free = setTimeout(function () { v.removeAttribute("src"); v.load(); v.remove(); }, 600);
        }
        return;
      }
      if (v && v._free) { clearTimeout(v._free); v._free = null; }
      var vsrc = p.video; // extrait d'apercu seulement (le film complet, trop lourd, est reserve au lecteur)
      if (!vsrc || reduceMotion || (navigator.connection && navigator.connection.saveData)) return;
      if (!v) {
        v = document.createElement("video"); v.className = "snip"; v.muted = true; v.playsInline = true; v.preload = "auto";
        v.addEventListener("loadedmetadata", function () { var d = v.duration || 0; v._a = d > 12 ? d * 0.3 : 0; v._b = v._a + 4; try { v.currentTime = v._a; } catch (e) {} });
        v.addEventListener("timeupdate", function () { if (v._b && v.currentTime >= v._b) v.currentTime = v._a; });
        v.addEventListener("playing", function () { v.classList.add("on"); });
        v.src = vsrc; st.appendChild(v);
      }
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
    }
    function pauseSnips() { document.querySelectorAll("video.snip").forEach(function (v) { v.pause(); }); }
    var touchOnly = window.matchMedia("(hover: none)"), focusCard = null, focusRaf = 0;
    function pickFocus() {
      focusRaf = 0;
      if (!touchOnly.matches || work.classList.contains("about-mode") || player.classList.contains("on")) return;
      var r = work.getBoundingClientRect(), line = r.top + r.height * 0.4, best = null, bd = 1e9;
      feed.querySelectorAll(".card").forEach(function (c) {
        var b = c.querySelector(".still").getBoundingClientRect(), d = Math.abs((b.top + b.bottom) / 2 - line);
        if (b.bottom > r.top && d < bd) { bd = d; best = c; }
      });
      if (best === focusCard) return;
      if (focusCard) { focusCard.classList.remove("focus"); snip(focusCard.querySelector(".still"), focusCard._p, false); }
      focusCard = best;
      if (best) { best.classList.add("focus"); showProj(best._p); snip(best.querySelector(".still"), best._p, true); }
    }
    work.addEventListener("scroll", function () { if (!focusRaf) focusRaf = requestAnimationFrame(pickFocus); }, { passive: true });
    function render(slug, cat, delay) {
      curCat = cat; focusCard = null; setTimeout(pickFocus, 900);
      feed.className = "feed" + (mode === "gallery" ? " gallery" : "");
      feed.style.setProperty("--d", delay + "ms");
      clearProj();
      feed.textContent = "";
      WORK[slug].filter(function (p) { return cat === "FEATURED" ? p.f : p.cat === cat; }).sort(function (a, b) { return cat === "FEATURED" ? (a.fo || 0) - (b.fo || 0) : 0; }).forEach(function (p, i) {
        var d = document.createElement("div"); d.className = "card"; d.style.setProperty("--i", i);
        var st = document.createElement("div"); st.className = "still"; st.style.setProperty("--h", p.h);
        // Recadrage (admin) : l'extrait au survol ; la vignette aussi si « zoomThumb » est coché.
        if (p.zoom > 1) { st.style.setProperty("--z", p.zoom); if (p.zoomThumb) st.classList.add("zoomed"); }
        if (p.img) {
          var url = thumb(p.img, mode === "gallery" ? GW : FW), im = new Image();
          im.onload = im.onerror = (function (st, url) { return function () { st.style.setProperty("--img", 'url("' + url + '")'); st.classList.add("ready"); }; })(st, url);
          im.src = url;
        }
        var meta = document.createElement("div"); meta.className = "meta";
        var h = document.createElement("h3"); h.textContent = p.title;
        var s = document.createElement("p"); s.textContent = p.sub || p.cat;
        meta.appendChild(h); meta.appendChild(s);
        if (p.cat && cat === "FEATURED") { var cc = document.createElement("span"); cc.className = "ccat"; cc.textContent = p.cat; (mode === "gallery" ? meta : st).appendChild(cc); }
        d.appendChild(st); d.appendChild(meta); feed.appendChild(d);
        d._p = p;
        d.addEventListener("mouseenter", function (e) { if (!inZone(e)) return; showProj(p); snip(st, p, true); });
        d.addEventListener("mouseleave", function () { snip(st, p, false); if (selCard) showProj(selCard._p, 0); else document.body.classList.remove("proj-on"); });
        d.addEventListener("click", function (e) { if (!inZone(e)) return; openPlayer(p); });
      });
      // Ombre noire des vignettes (galerie) : calque fixe, sans video, derriere la grille ; calcule une fois par affichage.
      if (mode === "gallery") {
        var shade = document.createElement("div"); shade.className = "shade";
        for (var n = feed.children.length; n > 0; n--) shade.appendChild(document.createElement("i"));
        feed.insertBefore(shade, feed.firstChild);
      }
    }
    // Sur téléphone, si les onglets dépassent, ils défilent lentement vers la gauche, en boucle (une 2e copie suit
    // la 1re) ; un doigt sur les onglets met le défilement en pause quelques secondes.
    var tabsLoop = 0;
    function marquee() {
      var run = ++tabsLoop;
      cats.scrollLeft = 0;
      if (!phone.matches || reduceMotion || cats.scrollWidth <= cats.clientWidth + 2) return;
      var first = cats.firstElementChild, n = cats.children.length;
      tabSet(true);
      var half = cats.children[n].offsetLeft - first.offsetLeft, pos = 0, last = performance.now(), hold = last + 2500; // pause au début : FEATURED bien visible
      cats.ontouchstart = function () { hold = performance.now() + 4000; };
      cats.onscroll = function () { if (performance.now() < hold) pos = cats.scrollLeft; };
      (function step(t) {
        if (run !== tabsLoop || !document.body.classList.contains("viewing")) return;
        if (t > hold) { pos += (t - last) * 0.025; if (pos >= half) pos -= half; cats.scrollLeft = pos; }
        else if (pos >= half) { pos -= half; cats.scrollLeft = pos; }
        last = t; requestAnimationFrame(step);
      })(last);
    }
    var tabSet = null;
    function buildTabs(slug) {
      cats.textContent = ""; curCat = "FEATURED";
      tabSet = function (copy) { (CATS_BY[slug] || CATS).forEach(function (c) { tabButton(c, copy); }); aboutButton(copy); };
      function tabButton(c, copy) {
        var b = document.createElement("button");
        b.textContent = c; b.dataset.cat = c; if (c === curCat) b.className = "on";
        if (copy) b.setAttribute("aria-hidden", "true");
        b.addEventListener("click", function () {
          cats.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x.dataset.cat === c); });
          work.classList.remove("about-mode"); document.body.classList.remove("about-on");
          work.scrollTop = 0; render(slug, c, 0);
        });
        cats.appendChild(b);
      }
      function aboutButton(copy) {
      var ab = document.createElement("button");
      ab.textContent = "ABOUT"; ab.className = "sep"; ab.dataset.cat = "ABOUT";
      if (copy) ab.setAttribute("aria-hidden", "true");
      ab.addEventListener("click", function () {
        cats.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x.dataset.cat === "ABOUT"); });
        about.textContent = "";
        var d = ABOUT[slug] || {};
        var lang = "fr"; try { if (localStorage.getItem("kinou-lang") === "en") lang = "en"; } catch (e) {}
        var bio = document.createElement("div");
        function fill() {
          bio.textContent = "";
          (lang === "en" && d.bioEn ? d.bioEn : (d.bio || [])).forEach(function (t) { var p = document.createElement("p"); p.textContent = t; bio.appendChild(p); });
        }
        if (d.bioEn) {
          var tg = document.createElement("div"); tg.className = "lang";
          ["fr", "en"].forEach(function (l) {
            var b = document.createElement("button"); b.textContent = l.toUpperCase(); b.setAttribute("aria-label", l === "fr" ? "Français" : "English");
            if (l === lang) b.className = "on";
            b.addEventListener("click", function () {
              lang = l; try { localStorage.setItem("kinou-lang", l); } catch (e) {}
              tg.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
              fill();
            });
            tg.appendChild(b);
          });
          about.appendChild(tg);
        }
        fill(); about.appendChild(bio);
        var links = document.createElement("div"); links.className = "links";
        [["CV", "cv"], ["INSTAGRAM", "instagram"], ["WEBSITE", "website"]].forEach(function (l) {
          var a = document.createElement("a"); a.textContent = l[0] + " \u2197"; a.href = d[l[1]] || "#";
          if (d[l[1]]) { a.target = "_blank"; a.rel = "noopener"; } else { a.addEventListener("click", function (e) { e.preventDefault(); }); }
          links.appendChild(a);
        });
        about.appendChild(links);
        work.classList.add("about-mode"); work.scrollTop = 0; clearProj();
        if (d.img) {
          aboutbg.style.backgroundImage = (d.shade || 'linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.3) 45%, rgba(0,0,0,.6))') + ', url("' + d.img + '")';
          aboutbg.style.backgroundPosition = d.pos || "center 30%";
          document.body.classList.add("about-on");
        }
        about.style.animation = "none"; void about.offsetWidth; about.style.animation = "";
      });
      cats.appendChild(ab);
      }
      tabSet(false);
      requestAnimationFrame(marquee);
      // Choix de l'affichage (icones, au-dessus du feed) : feed (une colonne) ou galerie (mosaique).
      modes.textContent = "";
      var ICONS = {
        feed: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="16" height="7" rx="1"/><rect x="3" y="12" width="16" height="7" rx="1"/></svg>',
        gallery: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="12" y="3" width="7" height="7" rx="1"/><rect x="3" y="12" width="7" height="7" rx="1"/><rect x="12" y="12" width="7" height="7" rx="1"/></svg>'
      };
      ["feed", "gallery"].forEach(function (m) {
        var b = document.createElement("button");
        b.innerHTML = ICONS[m]; b.dataset.mode = m;
        b.setAttribute("aria-label", m === "feed" ? "Affichage feed" : "Affichage galerie");
        b.title = m === "feed" ? "Feed" : "Galerie";
        if (mode === m) b.className = "on";
        b.addEventListener("click", function () {
          mode = phone.matches ? "feed" : m;
          try { localStorage.setItem("kinou-mode", mode); } catch (e) {}
          modes.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
          work.scrollTop = 0; render(slug, curCat, 0);
        });
        modes.appendChild(b);
      });
    }
    function showWork(slug, film) {
      if (!WORK[slug]) {
        document.body.classList.remove("has-work");
        // Fiche pas encore chargee : on la charge, puis on affiche si la page est toujours ouverte.
        loadDP(slug).then(function (d) { if (d && view && view.o.slug === slug) openWork(slug, film); });
        return;
      }
      document.body.classList.add("has-work");
      setTimeout(function () { warmAll(slug); }, 1200); // apres FEATURED : les autres categories
      work.classList.remove("about-mode"); document.body.classList.remove("about-on"); work.scrollTop = 0; mode = defMode(); buildTabs(slug); render(slug, "FEATURED", 700);
      if (film) {
        var cards = feed.querySelectorAll(".card");
        var pick = film.slate && [].some.call(cards, function (c) { return c._p.slate === film.slate; });
        for (var i = 0; i < cards.length; i++) if (pick ? cards[i]._p.slate === film.slate : cards[i]._p.open) {
          var hv = HomeAPI.videoEl();
          selCard = cards[i]; selCard.classList.add("sel"); showProj(selCard._p, hv ? hv.currentTime : 0);
          break;
        }
      }
    }
    // Template des pages DP : un seul ("default") pour tous les DPs. Une fiche peut demander
    // "template": "special" ; tant qu'aucun template special n'existe, default s'applique.
    var TEMPLATES = { "default": showWork };
    function openWork(slug, film) { (TEMPLATES[TEMPLATE[slug]] || TEMPLATES["default"])(slug, film); }
    document.querySelectorAll("li a[data-view]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var t = a.textContent;
        openView({ text: t, slug: a.dataset.view, from: "list", a: a, rect: nameRect(a, split(t).main) });
      });
    });
    function show(t) {
      var b = document.body;
      b.classList.toggle("is-home", t === "home"); b.classList.toggle("is-list", t === "list");
      document.documentElement.style.overflow = t === "home" ? "hidden" : "";
      document.getElementById("home").style.display = t === "home" ? "" : "none";
      if (t === "home") HomeAPI.resume(); else { HomeAPI.pause(); window.scrollTo(0, 0); }
    }
    document.getElementById("name").addEventListener("mouseover", function (e) { var a = e.target.closest("a"); if (a && a.dataset.slug) loadDP(a.dataset.slug); }); // precharge la fiche
    // Menu du téléphone (burger) : volet à gauche, fond flou de ce qu'il y a derrière.
    var drawer = document.getElementById("drawer"), burger = document.getElementById("burger");
    function menu(on) {
      drawer.classList.toggle("on", on); document.body.classList.toggle("menu-on", on);
      drawer.setAttribute("aria-hidden", on ? "false" : "true"); burger.setAttribute("aria-expanded", on ? "true" : "false");
    }
    burger.addEventListener("click", function () { menu(true); });
    drawer.addEventListener("click", function (e) { if (e.target === drawer || e.target.closest(".dclose")) menu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && drawer.classList.contains("on")) { e.stopImmediatePropagation(); menu(false); } }, true);
    // Liens de l'en-tete pas encore actifs (spotlight, fiction).
    document.querySelectorAll("[data-soon]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); }); });
    window.Site = { prefetch: warmThumbs, fromHome: function (p, a) { openView({ text: a.dataset.name, slug: a.dataset.slug, from: "home", rect: homeNameRect(a), film: p }); } };
    document.querySelector(".logo").addEventListener("click", function (e) { e.preventDefault(); closeView(true); show("home"); });
    document.querySelector(".nav-btn").addEventListener("click", function (e) {
      e.preventDefault();
      if (view && view.o.from === "home") {
        // arrive depuis l'accueil : la liste prend la place, et le nom y retourne en reduisant
        var la = document.querySelector('li a[data-view="' + view.o.slug + '"]');
        if (la) { view.o.from = "list"; view.o.a = la; show("list"); }
      }
      if (view && view.o.from === "list") { closeView(); return; }
      closeView(true); show("list");
    });
    // Liens directs : page-du-site#slug-du-chef-op ouvre directement sa page.
    function routeFromHash() {
      var slug = location.hash.slice(1);
      var a = slug && document.querySelector('li a[data-view="' + slug + '"]');
      if (!a || view) return;
      show("list");
      openView({ text: a.textContent, slug: slug, from: "list", a: a, instant: true });
    }
    window.addEventListener("hashchange", function () { if (!location.hash && view) closeView(); else if (location.hash && !view) routeFromHash(); });
    if (location.hash.length > 1) routeFromHash();
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (plight.classList.contains("on")) closeStill(); else if (player.classList.contains("on")) closePlayer(); else closeView(); } });
  }

  // Logo (data/site.json, onglet « contact » de l'admin) : image à la place du texte « kinou ».
  // Le logo n'apparaît qu'une fois connu (pas de « kinou » texte juste avant l'image) ; la dernière version,
  // réduite proprement (8 × sa hauteur affichée : nette au zoom), est gardée dans le navigateur pour s'afficher tout de suite.
  var logoEl = document.querySelector(".logo"), LOGO_KEY = "kinou-logo", logoSaved = null;
  try { logoSaved = JSON.parse(localStorage.getItem(LOGO_KEY)); } catch (e) {}
  function logoText() {
    logoEl.classList.remove("img"); logoEl.textContent = "kinou"; logoEl.classList.add("ready");
  }
  function logoImg(src, h) {
    var im = new Image(); im.alt = "kinou"; im.src = src;
    logoEl.textContent = ""; logoEl.appendChild(im); logoEl.classList.add("img", "ready");
    logoEl.style.setProperty("--logo-h", (h || 36) + "px");
  }
  function logoKeep(o) { try { localStorage.setItem(LOGO_KEY, JSON.stringify(o)); } catch (e) {} }
  // Réduction par moitiés successives : bien plus net qu'une seule réduction d'une très grande image.
  function logoShrink(im, h) {
    var H = h * 8, W = Math.round(im.naturalWidth * H / im.naturalHeight), src = im, w = im.naturalWidth, hh = im.naturalHeight;
    if (hh <= H) return null;
    while (hh / 2 > H) {
      var c = document.createElement("canvas"); c.width = w = Math.round(w / 2); c.height = hh = Math.round(hh / 2);
      var x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, w, hh); src = c;
    }
    var f = document.createElement("canvas"); f.width = W; f.height = H;
    var fx = f.getContext("2d"); fx.imageSmoothingQuality = "high"; fx.drawImage(src, 0, 0, W, H);
    try { return f.toDataURL("image/png"); } catch (e) { return null; }
  }
  if (logoSaved) { if (logoSaved.data) logoImg(logoSaved.data, logoSaved.h); else logoText(); }
  var logoWait = setTimeout(function () { if (!logoEl.classList.contains("ready")) logoText(); }, 2500);
  getJSON("site.json").then(function (c) {
    if (!c.logo) { clearTimeout(logoWait); logoKeep({}); if (!logoSaved || logoSaved.data) logoText(); return; }
    var h = c.logoHeight || 36;
    if (logoSaved && logoSaved.path === c.logo && logoSaved.h === h) return; // déjà affiché
    var im = new Image(); im.crossOrigin = "anonymous"; // lisible par le canvas (en local, les données viennent de la beta)
    im.onload = function () {
      clearTimeout(logoWait);
      var data = logoShrink(im, h) || im.src;
      logoImg(data, h);
      logoKeep(data.indexOf("data:") === 0 ? { path: c.logo, h: h, data: data } : {});
    };
    im.onerror = function () { clearTimeout(logoWait); if (!logoEl.classList.contains("ready")) logoText(); };
    im.src = DATA_BASE + c.logo;
  }).catch(function () { clearTimeout(logoWait); if (!logoEl.classList.contains("ready")) logoText(); });

  Promise.all([getJSON("home.json"), getJSON("dps/index.json")]).then(function (r) {
    // Ancien format : { dp, slug } ; nouveau (admin, bande Slate) : dps: [{ name, slug }].
    var slides = r[0].slides.map(function (p) { if (!p.dps) p.dps = [{ name: p.dp, slug: p.slug }]; return p; });
    initHome(slides, r[0].duration);
    initSite(r[1].dps);
  }).catch(function (e) { console.error("kinou : chargement des donnees impossible", e); });
})();
