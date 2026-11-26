// kinou — logique du site. Les donnees viennent des fichiers JSON de DATA_BASE.
(function () {
  // Vidéos jouées depuis NOTRE hébergement Amazon (copie de tout Slate le 25/11, au même chemin que sur le CloudFront de Slate) :
  // seul le début de l'adresse change ; les données gardent l'adresse Slate. Fichier absent chez nous (film ajouté sur Slate
  // depuis la copie) : repli automatique sur Slate (événement « error »). Même code dans app.js, b/index.html et l'admin.
  var vidURL = function (u) { return u; }; // adresse réellement jouée (Amazon, ou Slate si notre CloudFront ne répond pas)
  (function () {
    var SLATE = "https://d1ko11x0ybxl0h.cloudfront.net/", NOUS = "https://d3toxii6rvamjf.cloudfront.net/";
    vidURL = function (u) { return typeof u === "string" && u.indexOf(SLATE) === 0 && !panne ? NOUS + u.slice(SLATE.length) : u; };
    var d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
    Object.defineProperty(HTMLMediaElement.prototype, "src", { configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (u) { delete this.dataset.repliSlate; d.set.call(this, typeof u === "string" && u.indexOf(SLATE) === 0 && !panne ? NOUS + u.slice(SLATE.length) : u); } });
    // Lecture demandée (play) : relancée après le repli, sinon la vidéo restait arrêtée.
    var jouer = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { this.veutJouer = true; return jouer.apply(this, arguments); };
    // Notre CloudFront ne répond pas du tout (2 replis, aucune vidéo lue chez nous) : Slate directement pour la suite de la visite.
    var ok = false, replis = 0, panne = false;
    document.addEventListener("loadeddata", function (ev) { var u = ev.target.getAttribute && ev.target.getAttribute("src"); if (u && u.indexOf(NOUS) === 0) ok = true; }, true);
    document.addEventListener("error", function (ev) {
      var v = ev.target, u = v instanceof HTMLMediaElement && v.getAttribute("src");
      if (!u || u.indexOf(NOUS) !== 0 || v.dataset.repliSlate) return;
      if (++replis >= 2 && !ok) panne = true;
      ev.stopImmediatePropagation(); // l'échec chez nous ne compte pas comme une erreur de la vidéo (ex. accueil : pas de passage à l'extrait)
      v.dataset.repliSlate = "1"; d.set.call(v, SLATE + u.slice(NOUS.length));
      if (v.autoplay || v.veutJouer) { var p = jouer.call(v); if (p && p.catch) p.catch(function () {}); }
    }, true);
  })();
  // Préchargement des extraits en fond (Gus 25/11) : chaque page télécharge ses extraits dans l'ordre (le plus haut d'abord),
  // 2 à la fois, en priorité basse, dans le cache du navigateur : au survol, l'extrait démarre tout de suite (~0,02 s au lieu
  // de ~0,5 s). Une nouvelle page remplace la file ; un extrait déjà téléchargé ne l'est pas deux fois.
  // Les vignettes d'abord (Gus 25/11 : vignettes très lentes) : la file attend que les images en cours (loadImg, pre.img) soient
  // arrivées, 4 s au plus après le dernier ajout, pour ne pas leur prendre la connexion.
  var pre = { file: [], faits: {}, actifs: 0, img: 0, t: 0, att: 0 };
  function precharger(urls, ajouter) {
    if (!ajouter) pre.file = [];
    if (navigator.connection && navigator.connection.saveData) return; // « économiseur de données » du téléphone : rien en fond
    pre.t = Date.now();
    urls.forEach(function (u) { u = u && vidURL(u); if (u && !pre.faits[u] && pre.file.indexOf(u) < 0) pre.file.push(u); });
    preSuite();
  }
  function preSuite() {
    // Lecteur ouvert (film, stills dessous) : rien en fond, la connexion est pour lui ; les préchargements en cours sont arrêtés et
    // remis en file (Gus 25/11 : stills lents) ; reprise à la fermeture du lecteur.
    var pl = document.getElementById("player");
    if (pl && pl.classList.contains("on")) {
      Object.keys(pre.cours || {}).forEach(function (u) { pre.cours[u].abort(); });
      if (!pre.att) pre.att = setTimeout(function () { pre.att = 0; preSuite(); }, 500); return;
    }
    if (pre.img > 0 && Date.now() - pre.t < 4000) { if (!pre.att) pre.att = setTimeout(function () { pre.att = 0; preSuite(); }, 150); return; }
    pre.cours = pre.cours || {};
    while (pre.actifs < 2 && pre.file.length) {
      var u = pre.file.shift(); if (pre.faits[u]) continue;
      pre.faits[u] = 1; pre.actifs++;
      (function (u) {
        var c = "AbortController" in window ? new AbortController() : null; if (c) pre.cours[u] = c;
        fetch(u, { mode: "no-cors", priority: "low", signal: c ? c.signal : undefined }).then(function (r) { return r.blob(); })
          .catch(function (e) { if (e && e.name === "AbortError") { delete pre.faits[u]; pre.file.unshift(u); } })
          .then(function () { delete pre.cours[u]; pre.actifs--; preSuite(); });
      })(u);
    }
  }
  // Adresses des pages : ROOT + <slug>/ (+ <catégorie> + /feed), comme sur kinou.fr, pour que les aperçus de lien (WhatsApp,
  // iMessage…) puissent montrer le chef op : un robot GitHub (tools/share-pages.mjs) fabrique <slug>/index.html avec son nom et
  // sa photo, qui renvoie ici avec #<slug>. Les anciennes adresses en « #<slug> » marchent toujours (puis sont réécrites).
  var ROOT = ((document.currentScript && document.currentScript.src) || location.href).replace(/assets\/js\/app\.js.*$/, "").replace(/[?#].*$/, "");
  var ROOT_PATH = new URL(ROOT, location.href).pathname;
  // Chemin de la page demandée : « #slug/cat/feed » ou, sans #, la fin de l'adresse après ROOT.
  function route() {
    if (location.hash.length > 1) return location.hash.slice(1);
    var p = location.pathname;
    return p.indexOf(ROOT_PATH) === 0 ? p.slice(ROOT_PATH.length).replace(/index\.html$/, "").replace(/^\/+|\/+$/g, "") : "";
  }
  // Ctrl / Cmd / Maj + clic (ou clic molette) sur un lien : on laisse le navigateur l'ouvrir dans un nouvel onglet (Gus 22/11).
  function newTab(e) { return e.metaKey || e.ctrlKey || e.shiftKey || (e.button || 0) !== 0; }
  // Adresse de la liste des chefs op (Gus 22/11).
  var LIST = "cinematographers";
  function pageURL(r) { return ROOT + (r ? r.replace(/^\/+/, "") + (r.indexOf("/") < 0 ? "/" : "") : "") + location.search; }
  // Arrivée directe sur la page d'un chef op (lien, rechargement) : accueil et liste masqués le temps qu'elle s'ouvre
  // (sinon on les voit passer une fraction de seconde).
  if (route()) document.documentElement.classList.add("deep");
  function undeep(ms) { setTimeout(function () { document.documentElement.classList.remove("deep"); }, ms || 0); }
  // Donnees JSON : publiees par l'admin (repo Kinou-DoP/admin), lues ici par le site officiel et la beta.
  // Sur Netlify : via /api/data du site (qui les lit dans GitHub). Ailleurs (GitHub Pages, en local) : directement dans le dépôt
  // admin public (raw.githubusercontent.com, cache 5 min) — les fonctions Netlify de la beta sont coupées (« Usage exceeded », 30/10).
  var ON_NETLIFY = /(^|\.)netlify\.app$|(^|\.)kinou\.fr$/.test(location.hostname);
  var DATA_BASE = ON_NETLIFY ? "/api/data/" : "https://raw.githubusercontent.com/Kinou-DoP/admin/main/data/";
  // Cloudflare Pages (essai, 16/11) : fiches JSON lues par la fonction /api/data du site (functions/), toujours à jour
  // (dernier commit de l'admin) ; images et CV restent lus directement dans le dépôt (pas d'appel de fonction pour eux).
  var ON_CF = /\.pages\.dev$/.test(location.hostname);
  var JSON_BASE = ON_CF ? ROOT + "api/data/" : DATA_BASE;
  function getJSON(path) {
    return fetch(JSON_BASE + path).then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + JSON_BASE + path);
      return r.json();
    });
  }

  // Video club de l'admin (Gus 26/11 : « le video club sert partout ») : ce qu'on change dans la fenêtre d'un film du video club
  // (data/bibli/edits.json, clé « s<id Slate> » : vignette, extrait léger, film, titre, crédits, stills) s'applique aussi au site,
  // par-dessus les fiches, le spotlight, la fiction et l'accueil (vcApply). Fichier absent ou en erreur : le site sans retouches.
  var VC = {}, VCL = {}, VC_P = Promise.all([getJSON("bibli/edits.json").then(function (x) { VC = (x && x.films) || {}; }, function () {}),
    getJSON("bibli/library.json").then(function (x) { ((x && x.items) || []).forEach(function (it) { VCL[it.key] = it; }); }, function () {}),
    getJSON("bibli/meta.json").then(function (x) { VCM = (x && x.films) || {}; }, function () {})]);
  var VCM = {}; // meta.json (robot) : client de chaque film des pages ; affiché avant le titre sauf si l'admin le cache (`cshow: false`)
  function vcClient(id) { var m = /^\d+$/.test(id || "") ? VCM[id] : null; return m && m.client || ""; }
  // Vidéos importées ensemble (`grp` + `gi` dans library.json) : chacune montre les autres sous elle, dans le même ordre pour toutes (Gus 26/11).
  // Lignes `auto` recalculées ici (titres, vignettes, extraits à jour) tant que la ligne n'a pas été réglée à la main dans l'admin.
  function vcGroup(id) {
    var k = /^\d+$/.test(id || "") ? "s" + id : id, me = VCL[k]; if (!me || !me.grp) return null;
    var ms = Object.keys(VCL).map(function (x) { return VCL[x]; }).filter(function (x) { return x.grp === me.grp; }).sort(function (a, b) { return (a.gi || 0) - (b.gi || 0); });
    var l = ms.filter(function (m) { return m.key !== me.key; }).map(function (m) {
      var e = VC[m.key] || {}, full = typeof e.full === "string" && e.full ? e.full : m.full, sn = vcSnip(Object.assign({}, m, e), full);
      return { title: e.title || m.title, full: full, video: sn || e.video || m.video, img: e.img || m.img, key: m.key, auto: true };
    }).filter(function (x) { return x.full || x.video; });
    return l.length ? l : null;
  }
  var FN = ON_CF ? location.origin : "https://kinou-4tv.pages.dev"; // fonctions du site (/api/media)
  function vcOf(id) { return id ? VC[/^\d+$/.test(id) ? "s" + id : id] || null : null; } // id Slate, ou clé d'un import du video club (« i… », « e… »)
  // Extrait du video club : mp4 importé (relu par /api/media), sinon extrait léger 720p du robot (snip.v, s'il vient bien du film
  // affiché : vf), sinon l'extrait retouché (video). Un passage choisi sans extrait léger ne change rien (le site ne lit pas de passage).
  function vcSnip(e, full) {
    if (e.snipVideo) return FN + "/api/media?u=" + encodeURIComponent(e.snipVideo);
    if (e.snip && e.snip.v && (!e.snip.vf || !full || e.snip.vf === full)) return e.snip.v;
    return typeof e.video === "string" && e.video ? e.video : "";
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
      if (p.zoom > 1) { s.style.setProperty("--z", p.zoom); if (p.zoomPos) s.style.setProperty("--zp", p.zoomPos); } // recadrage réglé dans l'admin (enlève les bandes noires)
      if (p.phoneX !== undefined) s.style.setProperty("--pp", p.phoneX + "%"); // cadrage téléphone (admin)
      var inner = document.createElement("div"); inner.className = "in"; s.appendChild(inner);
      // Extrait HD (admin) : passage du film complet, de « start » pendant la durée d'un projet, sans le son.
      // Sinon (ou si le film complet ne se lit pas) : l'extrait Slate, plus compressé.
      var hd = p.full && p.start !== undefined;
      if (p.video || hd) {
        var v = document.createElement("video");
        v.muted = true; v.playsInline = true; v.preload = "none";
        v.dataset.src = hd ? p.full + "#t=" + p.start : p.video;
        if (hd) { v._hd = true; v._start = +p.start; }
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
        else if (v && v._hd) p = (v.currentTime - v._start) * 1000 / DURATION;
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
        name.textContent = ""; name.classList.toggle("multi", p.dps.length > 1);
        var ns = document.createElement("span"); ns.className = "ns"; name.appendChild(ns);
        p.dps.forEach(function (d, k) {
          if (k) { var amp = document.createElement("span"); amp.className = "amp"; amp.textContent = " & "; ns.appendChild(amp); }
          var parts = d.name.split(","), main = parts[0].trim(), tags = parts.slice(1).join(", ").trim();
          var a = document.createElement("a"); a.href = pageURL(d.slug); if (d.slug) a.dataset.slug = d.slug; a.dataset.name = d.name; // sans page (chef op hors liste ou caché) : nom sans lien
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
        try { v.currentTime = v._hd ? v._start : 0; } catch (e) {}
        v.onended = next;
        v.onerror = function () {
          if (!v._hd) { if (i === cur) later(); return; }
          if (!snippetOf(v, i)) { if (i === cur) later(); return; }
          if (i === cur) { var r = v.play(); if (r && r.catch) r.catch(function () {}); }
        };
        if (v.error) v.onerror(); // passage HD préchargé déjà en erreur
        else { var pr = v.play(); if (pr && pr.catch) pr.catch(function () { if (i === cur && !v.error) later(); }); }
        preloadNext(i);
      } else { later(); }
    }
    // Passage HD fini (durée d'un projet) : projet suivant. Accueil en pause ou projet qui n'est plus affiché : la vidéo
    // s'arrête et revient au début du passage (jamais la suite du film : générique, cartons…).
    slides.forEach(function (s, i) {
      var v = s.querySelector("video");
      if (v) v.addEventListener("timeupdate", function () {
        if (!v._hd || v.currentTime < v._start + DURATION / 1000) return;
        if (i === cur && active) next();
        else { v.pause(); try { v.currentTime = v._start; } catch (e) {} }
      });
    });
    // Film complet illisible : retour à l'extrait Slate pour ce projet.
    function snippetOf(v, i) {
      v._hd = false;
      if (!PROJECTS[i].video) return false;
      v.dataset.src = v.src = PROJECTS[i].video; return true;
    }
    // Le passage HD du projet suivant se charge à l'avance (le film complet est plus long à démarrer).
    function preloadNext(i) { // les 2 projets suivants (Gus 25/11 : avant, seulement le suivant)
      for (var k = 1; k <= 2; k++) {
        var n = slides[(i + k) % slides.length].querySelector("video");
        if (n && !n.src) { n.preload = "auto"; n.src = n.dataset.src; }
      }
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
    // Clic (ou toucher) sur la vidéo de l'accueil : le film dans le lecteur, comme depuis la page d'un chef op.
    document.getElementById("home").addEventListener("click", function (e) {
      if (!active || e.target.closest("a, button, .info") || e.clientY < 90) return; // zone de l'en-tête : pas de lecteur
      if (window.Site && Site.playHome) Site.playHome(PROJECTS, cur);
    });
    name.addEventListener("click", function (e) {
      var a = e.target.closest("a"); if (!a || newTab(e)) return;
      e.preventDefault(); if (active && window.Site && a.dataset.slug) Site.fromHome(PROJECTS[cur], a);
    });
    window.HomeAPI = {
      pause: function () { active = false; clearTimeout(timer); var v = slides[cur].querySelector("video"); if (v) v.pause(); },
      resume: function () {
        if (active) return; active = true; var v = slides[cur].querySelector("video");
        // Passage HD : on reprend dans le passage (sinon au début du passage).
        if (v && v._hd && (v.currentTime < v._start - 0.5 || v.currentTime >= v._start + DURATION / 1000 - 0.3)) { try { v.currentTime = v._start; } catch (e) {} }
        if (v && v.src) { var pr = v.play(); if (pr && pr.catch) pr.catch(later); v.onended = next; } else later();
      },
      // Passage HD en cours [début, fin] en secondes (fond de la page contact : le même passage, en boucle).
      segment: function () { var v = slides[cur].querySelector("video"); return v && v._hd ? [v._start, v._start + DURATION / 1000] : null; },
      videoEl: function () { return slides[cur].querySelector("video"); },
      current: function () { return PROJECTS[cur]; }
    };
    go(Math.floor(Math.random() * PROJECTS.length)); // on arrive sur un film au hasard, puis l'ordre de la bande
  }

  // ---------- Liste des DPs + page DP (template unique) ----------
  function initSite(DPS, HOME, HIDDEN) {
    // Liste des DPs (data/dps/index.json), meme balisage que le prototype.
    // Pages cachées (HIDDEN) : un lien invisible, hors de la liste et de la roulette, seulement pour que leur adresse ouvre la page
    // (bouton « Voir sur le site » de l'admin, Gus 24/11).
    var ul = document.querySelector("main ul");
    DPS.concat(HIDDEN || []).forEach(function (d) {
      var li = document.createElement("li"), a = document.createElement("a");
      if (d.hidden) { li.style.display = "none"; li.className = "off"; }
      a.setAttribute("href", pageURL(d.slug)); a.dataset.view = d.slug; a.dataset.img = d.img || "images/" + d.slug + ".jpg";
      a.textContent = d.name; a.dataset.t = d.name; // data-t : version grasse superposée au survol (main.css)
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
        if (bgWanted(a)) {
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
        if (!bgWanted(a)) return;
        var f = d && (WORK[slug] || []).filter(function (p) { return p.f && p.video; }).sort(function (x, y) { return (x.fo || 0) - (y.fo || 0); })[0];
        if (!f) { showBg(a); return; } // pas de fiche ou pas d'extrait : image s'il y en a une
        if (bgvid.dataset.src !== f.video) { bgvid.src = f.video; bgvid.dataset.src = f.video; }
        bgvid.style.setProperty("--z", f.zoom > 1 ? f.zoom : 1); bgvid.style.setProperty("--zp", f.zoomPos || "50% 50%"); bgvid.style.setProperty("--pp", (f.phoneX !== undefined ? f.phoneX : 50) + "%"); // cadrage téléphone (admin)
        try { bgvid.currentTime = 0; } catch (e) {}
        bgvid.onplaying = function () { if (bgWanted(a)) bgvid.classList.add("on"); };
        var pr = bgvid.play(); if (pr && pr.catch) pr.catch(function () {});
      });
    }
    // Le fond suit le nom survolé, focalisé, ou au centre de la roulette (téléphone).
    var roulSel = null;
    function bgWanted(a) { return a.matches(":hover") || a === document.activeElement || a.dataset.view === roulSel; }
    function hide() { bg.style.opacity = 0; bgvid.classList.remove("on"); bgvid.onplaying = null; bgvid.pause(); }

    // Extrait du fond d'un chef op (1er film FEATURED), sans le jouer : pour le préchargement autour du nom survolé.
    function bgSnip(slug) {
      return loadDP(slug).then(function (d) { var f = d && (WORK[slug] || []).filter(function (p) { return p.f && p.video; }).sort(function (x, y) { return (x.fo || 0) - (y.fo || 0); })[0]; return f && f.video; });
    }
    var listeNoms = Array.prototype.slice.call(document.querySelectorAll("li a"));
    function autour(a) {
      var i = listeNoms.indexOf(a), l = [];
      for (var k = 1; k <= 3; k++) { if (listeNoms[i + k]) l.push(listeNoms[i + k]); if (listeNoms[i - k]) l.push(listeNoms[i - k]); }
      l.forEach(function (n) { if (n.dataset.view) bgSnip(n.dataset.view).then(function (u) { if (u) precharger([u], true); }, function () {}); });
    }
    document.querySelectorAll("li a").forEach(function (a) {
      a.addEventListener("mouseenter", function () { showBgVideo(a); autour(a); });
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
    // Pendant son déplacement, le nom se floute d'un coup (léger) puis redevient net vers 60 % du trajet (Gus 28/10, comme l'arrivée des onglets).
    function heroBlur() {
      if (!hero.animate || reduceMotion) return;
      hero.animate([{ filter: "blur(0)" }, { filter: "blur(.09em)", offset: .08 }, { filter: "blur(.04em)", offset: .35 }, { filter: "blur(0)", offset: .58 }, { filter: "blur(0)" }], { duration: ANIM });
    }
    function homeNameRect(a) { return (a ? a.querySelector(".n") : document.querySelector("#home .name .n")).getBoundingClientRect(); }
    // o = { text, slug, rect (position de depart du nom), from: "home" | "list", a (lien de la liste), film (projet de l'accueil) }
    function openView(o) {
      if (view) return;
      var parts = split(o.text);
      view = { o: o, main: parts.main, t0: o.instant ? 0 : Date.now() };
      document.title = parts.main + " — kinou";
      // D'une page à l'autre (chef op → spotlight) : les onglets étaient encore affichés ; on les cache tout de suite
      // pour qu'ils reviennent à la fin de l'animation du nouveau titre.
      cats.style.transition = "none"; cats.style.opacity = "0"; void cats.offsetWidth; cats.style.transition = cats.style.opacity = "";
      document.body.classList.toggle("spot", o.slug === SPOT || o.slug === FIC); // spotlight, fiction : onglets en ligne au-dessus (ordinateur)
      document.body.classList.toggle("fic", o.slug === FIC);
      document.body.classList.toggle("cpage", o.slug === CONTACT); // page contact (pas d'onglets)
      var r = o.rect;
      hero.textContent = ""; hero.classList.remove("ready"); hero.style.left = hero.style.right = hero.style.width = ""; // place figée par closeView
      var n = document.createElement("span"); n.className = "n"; n.textContent = parts.main; hero.appendChild(n);
      if (parts.tags) { var tg = document.createElement("div"); tg.className = "tags"; tg.textContent = parts.tags; hero.appendChild(tg); }
      document.body.classList.toggle("hero-tags", !!parts.tags); // place pour « AFC… » sous le nom (téléphone)
      hero.style.transition = "none"; hero.style.transform = "none"; hero.style.opacity = 0;
      var f = n.getBoundingClientRect();
      hero.style.transform = o.instant ? "none" : startTransform(r, f);
      void hero.offsetWidth;
      document.documentElement.style.overflow = "hidden";
      document.body.classList.remove("closing");
      document.body.classList.add("viewing");
      hero.style.transition = o.instant ? "none" : "transform " + ANIM + "ms " + EASE + ", opacity .25s";
      hero.style.transform = "none"; hero.style.opacity = 1; if (!o.instant) heroBlur();
      if (o.replaceHistory) { try { history.replaceState({ k: "dp", slug: o.slug }, "", pageURL(o.slug)); } catch (e) {} }
      else if (!o.noHistory) pushPage({ k: "dp", slug: o.slug });
      hero.classList.add("ready");
      if (o.from === "home") HomeAPI.pause();
      openWork(o.slug, o.from === "home" ? o.film : null);
    }
    function closeView(instant) {
      if (!view) return;
      var o = view.o;
      if (o.from === "list" && roul.active()) o.a = roul.center(o.slug);
      var rect = o.from === "home" ? homeNameRect() : o.a ? nameRect(o.a, view.main) : null;
      if (!rect || !rect.width) instant = true; // spotlight ouvert par l'adresse, ou lien caché (menu du téléphone)
      // Le titre garde sa place pendant qu'il s'efface (spotlight, fiction, contact : à gauche ; sinon il sautait à droite).
      var hr = hero.getBoundingClientRect(); hero.style.left = hr.left + "px"; hero.style.width = hr.width + "px"; hero.style.right = "auto";
      view = null; document.body.classList.remove("spot", "fic", "cpage"); document.title = "kinou"; cats.style.transitionDelay = "";
      var f = hero.querySelector(".n").getBoundingClientRect();
      hero.classList.remove("ready");
      document.body.classList.remove("viewing");
      projvid.pause(); pauseSnips();
      function done() {
        document.body.classList.remove("closing");
        document.documentElement.style.overflow = document.body.classList.contains("is-home") ? "hidden" : "";
      }
      if (o.from === "home" || (o.from === "spot" && document.body.classList.contains("is-home"))) HomeAPI.resume();
      if (instant) { hero.style.transition = "opacity .2s"; hero.style.opacity = 0; done(); return; }
      document.body.classList.add("closing");
      hero.style.transition = "transform " + ANIM + "ms " + EASE + ", opacity .3s .7s";
      hero.style.transform = startTransform(rect, f); heroBlur();
      hero.style.opacity = 0;
      setTimeout(done, ANIM + 100);
    }
    // Feed selectif par technicien : fiches data/dps/<slug>.json, chargees a la demande.
    // f: true = fait partie des projets FEATURED (fo = rang) ; img: chemin d'une image de couverture (optionnel).
    var CATS = ["FEATURED", "BEAUTY", "TEXTURES", "FOOD", "COMEDY", "LIFESTYLE", "AUTOMOTIVE"];
    var WORK = {}, CATS_BY = {}, TEMPLATE = {}, SHOW = {}, loading = {};
    function loadDP(slug) {
      if (!loading[slug]) loading[slug] = (slug === SPOT ? getJSON("spotlight.json").then(spotToDP) : slug === FIC ? getJSON("fiction.json").then(ficToDP) : getJSON("dps/" + slug + ".json"))
        .then(function (d) { return VC_P.then(function () { register(d); if (!MULTI[slug]) live(d); return d; }); }, function () { return null; });
      return loading[slug];
    }
    // ---------- Spotlight (data/spotlight.json, rubrique « spotlight » de l'admin) ----------
    // Une bande Slate de films de tous les chefs op, lue en entier par le robot GitHub de l'admin (`films`), affichée comme une
    // page de chef op : onglet ALL (= FEATURED : tous les films, dans l'ordre de la bande) puis une catégorie par onglet
    // (`categories`, d'après les types de contenu Slate de chaque film : Commercial, Music Video, Art Video…).
    // Corrections de l'admin dans `overrides` (comme une fiche). Chefs op crédités : dernière ligne des crédits.
    var SPOT = "spotlight";
    function spotToDP(s) {
      var up = function (x) { return String(x).trim().toUpperCase(); };
      var cats = (s.categories || ["COMMERCIAL", "MUSIC VIDEO", "ART VIDEO"]).map(up), clips = [];
      (s.films || []).forEach(function (f, i) {
        var fc = (f.cats || []).map(up).map(function (c) { return c === "ART FILM" ? "ART VIDEO" : c; }), mine = cats.filter(function (c) { return fc.indexOf(c) > -1; }); // « Art Film » sur Slate = ART VIDEO
        var base = { title: f.title, slate: f.slate };
        ["sub", "video", "full", "img", "images", "ratios"].forEach(function (k) { if (f[k]) base[k] = f[k]; });
        if (f.artists && f.artists.length) base.dps = f.artists.map(dpByName); // « DoP Nom » sous les crédits, liens vers leur page
        (mine.length ? mine : [""]).forEach(function (c, k) {
          var e = Object.assign({}, base, { cat: c });
          if (!k) { e.featured = true; e.featuredOrder = i + 1; }
          clips.push(e);
        });
      });
      return { slug: SPOT, name: "Spotlight", hue: 30, categories: ["FEATURED"].concat(cats), clips: clips, overrides: s.overrides || {} };
    }
    // Chef op crédité sur Slate → sa page (nom comparé sans accents ni « , AFC… »).
    function plainName(t) { return split(t).main.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
    function dpByName(n) {
      var k = plainName(n), d = DPS.filter(function (x) { return plainName(x.name) === k; })[0];
      return d ? { name: d.name, slug: d.slug } : { name: n };
    }
    // Ligne « DoP Nom & Nom » (spotlight) : noms en blanc cassé, liens vers la page du chef op.
    function dpLine(p, cls, fromPlayer) {
      var who = document.createElement("p"); who.className = cls;
      who.appendChild(document.createTextNode("DoP "));
      p.dps.forEach(function (d, k) {
        if (k) who.appendChild(document.createTextNode(" & "));
        var a = document.createElement(d.slug ? "a" : "span"); a.textContent = split(d.name).main;
        if (d.slug) {
          a.href = pageURL(d.slug);
          a.addEventListener("click", function (e) { e.stopPropagation(); if (newTab(e)) return; e.preventDefault(); toDP(d, a, fromPlayer); });
        }
        who.appendChild(a);
      });
      return who;
    }
    // Depuis une page ouverte (spotlight) : on la quitte pour la page du chef op (le bouton retour y revient).
    function toDP(d, a, fromPlayer) {
      if (fromPlayer) { closePlayer(true); if (pushed > 0) pushed--; }
      var home = document.body.classList.contains("is-home"), li = document.querySelector('li a[data-view="' + d.slug + '"]');
      if (view) closeView(true);
      openView({ text: li ? li.textContent : d.name, slug: d.slug, from: home ? "home" : "list", a: li, rect: a.getBoundingClientRect(), replaceHistory: fromPlayer });
    }
    // ---------- Fiction (data/fiction.json, rubrique « fiction » de l'admin) ----------
    // Comme le spotlight (bande Slate lue par le robot, `films`), mais les onglets sont réglés à la main dans l'admin, film par
    // film (`overrides[id]`) : `status` new | soon | past (défaut past), `genre` (onglet si film sorti), `platforms`, `date` (AAAA-MM-JJ), `poster`.
    // NEW RELEASES = FEATURED interne ; PAST RELEASES montre tous les films sortis, et ses genres apparaissent alors à côté.
    // FIC_ALL : tous les longs (ou courts) quel que soit le statut (new, soon, past), pour les liens « Nos longs métrages » du suivi
    // des festivals de l'admin (Gus 16/11) : adresse fiction/feature-films ; onglet affiché seulement quand il est ouvert (.only).
    var FIC_ALL = { "FEATURE FILM": "FEATURE FILMS", "SHORT FILM": "SHORT FILMS" };
    var FIC = "fiction", FIC_GENRES = ["FEATURE FILM", "SERIES", "DOCUMENTARY", "SHORT FILM"], PAST = ["PAST RELEASES"].concat(FIC_GENRES);
    var MULTI = { spotlight: true, fiction: true }; // pages de plusieurs chefs op (« DoP Nom » cliquable, pas d'About)
    // Coming soon → New release tout seul le jour de la sortie, à partir de 9 h (heure de Paris) (Gus 18/11) ; même règle dans l'admin (ficStatus).
    function ficOut(d) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return false;
      var now; try { now = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).format(new Date()); } catch (e) { now = new Date().toISOString().slice(0, 13).replace("T", " "); }
      var day = now.slice(0, 10), h = +now.slice(11, 13);
      return day > d || (day === d && h >= 9);
    }
    function ficStatus(o) { var st = (o && o.status) || "past"; return st === "soon" && ficOut(o.date) ? "new" : st; }
    function ficToDP(s) {
      var ov = s.overrides || {}, clips = [];
      // NEW RELEASES : 9 films au plus (Gus 04/11) ; au-delà, les plus anciens (date de sortie ; sans date = tout juste ajouté,
      // donc gardé ; même date : ordre de la bande) vont dans PAST RELEASES. Même règle dans l'admin (ficCapNew).
      var keepNew = {};
      (s.films || []).map(function (f, i) { return { f: f, i: i, d: (ov[f.slate] || {}).date || "9999" }; })
        .filter(function (x) { return ficStatus(ov[x.f.slate]) === "new"; })
        .sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : a.i - b.i; })
        .slice(0, 9).forEach(function (x) { keepNew[x.f.slate] = true; });
      (s.films || []).forEach(function (f, i) {
        var o = ov[f.slate] || {}, st = ficStatus(o);
        if (st === "new" && !keepNew[f.slate]) st = "past";
        var base = { title: f.title, slate: f.slate };
        ["sub", "video", "full", "img", "images", "ratios"].forEach(function (k) { if (f[k]) base[k] = f[k]; });
        if (f.artists && f.artists.length) base.dps = f.artists.map(dpByName);
        function add(c, extra) { clips.push(Object.assign({}, base, { cat: c }, extra || {})); }
        var g = String(o.genre || "").toUpperCase(); if (FIC_ALL[g]) add(FIC_ALL[g]);
        if (st === "new") add("", { featured: true, featuredOrder: i + 1 });
        else if (st === "soon") add("COMING SOON");
        else { add("PAST RELEASES"); if (o.genre) add(String(o.genre).toUpperCase()); }
      });
      var used = {}; clips.forEach(function (c) { used[c.cat] = true; });
      var cats = ["FEATURED", "COMING SOON", "PAST RELEASES"].concat(FIC_GENRES.filter(function (g) { return used[g]; }))
        .concat(Object.keys(FIC_ALL).map(function (g) { return FIC_ALL[g]; }).filter(function (c) { return used[c]; }));
      return { slug: FIC, name: "Fiction", hue: 30, categories: cats, clips: clips, overrides: ov };
    }
    // Date de sortie sur la vignette (NEW RELEASES et COMING SOON) : « 16 Oct » (en anglais, comme le reste du site).
    function ficDate(d) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ""); if (!m) return "";
      return +m[3] + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m[2] - 1];
    }
    // Cadrage cinémascope (2,39:1) d'un film en 16:9 : thumbCrop (vignette) et snipCrop (extrait) = { z, x, y } réglés dans l'admin
    // (z ≥ 1 = agrandissement ; x, y = 0–100, position de la partie gardée ; absent = centre, sans agrandissement).
    var SCOPE = 2.39, VID_A = 16 / 9;
    function scopeCrop(st, p) {
      var t = p.thumbCrop || {}, s = p.snipCrop || {}, n = function (v) { return v === undefined ? 50 : v; };
      st.style.backgroundSize = (t.z || 1) * 100 + "% auto"; st.style.backgroundPosition = n(t.x) + "% " + n(t.y) + "%";
      var z = s.z || 1;
      st.style.setProperty("--cw", z * 100 + "%");
      st.style.setProperty("--cx", -n(s.x) * (z - 1) + "%");
      st.style.setProperty("--cy", -n(s.y) * (z * SCOPE / VID_A - 1) + "%");
    }
    function dataURL(u) { return /^(https?:|data:)/.test(u) ? u : DATA_BASE + u; }
    function catLabel(slug, c) { return slug === SPOT && c === "FEATURED" ? "ALL" : slug === FIC && c === "FEATURED" ? "NEW RELEASES" : c; }
    // Pages de l'en-tête (spotlight, contact), ouvertes depuis l'en-tête ou le menu du téléphone : le mot devient le titre.
    var CONTACT = "contact", PAGES = { spotlight: "Spotlight", fiction: "Fiction", contact: "Contact" };
    function openSpot(a, opts) { openPage(SPOT, a, opts); }
    function openPage(slug, a, opts) {
      if (view && view.o.slug === slug) return;
      if (view) closeView(true);
      var o = { text: PAGES[slug], slug: slug, from: "spot", a: a, rect: a ? a.getBoundingClientRect() : null, instant: !a };
      for (var k in opts || {}) o[k] = opts[k];
      if (document.body.classList.contains("is-home")) HomeAPI.pause();
      openView(o);
    }
    document.querySelectorAll("[data-spot], [data-contact], [data-fiction]").forEach(function (a) {
      a.setAttribute("href", pageURL(a.hasAttribute("data-contact") ? CONTACT : a.hasAttribute("data-fiction") ? FIC : SPOT));
      a.addEventListener("click", function (e) {
        if (newTab(e)) return;
        e.preventDefault();
        if (document.body.classList.contains("menu-on")) menu(false);
        openPage(a.hasAttribute("data-contact") ? CONTACT : a.hasAttribute("data-fiction") ? FIC : SPOT, a);
      });
    });
    // Fiche avec bundle Slate : la page s'affiche tout de suite avec la copie enregistree dans la fiche,
    // puis se met a jour sans bruit quand /api/dp/<slug> (lu sur Slate, cache 10 min) repond, si quelque chose a change.
    function live(d) {
      if (!d.bundle || !ON_NETLIFY) return; // /api/dp n'existe que sur Netlify : ailleurs, la copie de la fiche (tenue à jour par l'admin)
      fetch(DATA_BASE.replace(/data\/$/, "") + "dp/" + d.slug).then(function (r) { if (!r.ok) throw r; return r.json(); }).then(function (s) {
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
      // Onglet demandé dans l'adresse qui n'existait pas encore dans la copie de la fiche (ajouté sur Slate) : on l'ouvre.
      var want = parseHash().cat, c0 = cat === "FEATURED" && want && (CATS_BY[slug] || CATS).filter(function (c) { return catSlug(c) === want; })[0];
      if (c0) { cat = c0; top = 0; }
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
    // Panne de shots (Slate, depuis le 14/11/2026) : leur service d'images (images.slatecdn.net) ne répond plus, mais les
    // fichiers d'origine restent lisibles sur leur stockage Amazon S3. L'adresse d'origine est écrite dans l'URL signée
    // (base64 après la signature et les options) : en cas d'erreur, on charge l'original (plus lourd, non réduit).
    function slateRaw(u) {
      var m = /^https:\/\/images\.slatecdn\.net\/[^/]+\/(.+)$/.exec(u || "");
      if (!m) return "";
      var b = m[1].split(/[?#]/)[0].split("/").filter(function (x) { return x.indexOf(":") < 0; }).join("").replace(/\.[a-z0-9]+$/i, "");
      try { var o = atob(b.replace(/-/g, "+").replace(/_/g, "/")); return /^https:\/\//.test(o) ? o : ""; } catch (e) { return ""; }
    }
    // Charge une image (de secours si besoin) puis cb(adresse qui a marché, ou celle de départ si aucune).
    function loadImg(u, cb) {
      var im = new Image(), raw = "", o = ORIG[u], u0 = u, fin = false;
      try { im.fetchPriority = "high"; } catch (e) {} // devant les vidéos (même serveur : notre CloudFront)
      pre.img++; var done = function (x) { if (!fin) { fin = true; pre.img--; } cb(x); };
      im.onload = function () { GOT[u0] = im.src; done(im.src); };
      // Notre vignette absente (film ajouté depuis) : celle de Slate, puis l'original sur S3.
      im.onerror = function () { if (o) { im.src = o; u = o; o = null; return; } if (!raw && (raw = slateRaw(u))) im.src = raw; else done(u); };
      im.src = u;
    }
    // Images affichées (<img>) : même secours, pour toutes (lecteur, photo en grand, catégorie de photos…).
    document.addEventListener("error", function (e) {
      var im = e.target; if (!im || im.tagName !== "IMG" || im.dataset.raw) return;
      if (ORIG[im.src]) { im.dataset.raw = "1"; im.src = ORIG[im.src]; return; } // notre copie absente : l'adresse d'origine
      var raw = slateRaw(im.src); if (raw) { im.dataset.raw = "1"; im.src = raw; }
    }, true);
    // Vignettes réduites chez nous (26/11) : le robot « Vignettes réduites » de l'admin fait, pour chaque image copiée de Slate, une
    // version WebP de 800 et de 1600 px sous thumbs/<chemin de l'image>-<largeur>.webp sur notre CloudFront. Le chemin est lu dans
    // l'adresse signée de Slate (slateRaw) ; ORIG garde l'adresse de Slate pour le secours (loadImg).
    var THUMBS = "https://d3toxii6rvamjf.cloudfront.net/thumbs/", ORIG = {}, GOT = {}; // GOT : adresse demandée → adresse qui a marché
    function ourThumb(u, w) {
      var raw = slateRaw(u), path = ""; if (!raw) return "";
      try { path = decodeURIComponent(new URL(raw).pathname); } catch (e) { return ""; }
      var m = /(kinou\/production\/.+)\.[a-z0-9]+$/i.exec(path); if (!m) return "";
      var t = THUMBS + m[1].split("/").map(encodeURIComponent).join("/") + "-" + (w > 800 ? 1600 : 800) + ".webp";
      ORIG[t] = u; return t;
    }
    // Images du video club envoyées avant le 25/11 (data/bibli/img/ du dépôt admin, sur raw.githubusercontent : cache 5 min, lent) :
    // copiées chez Amazon par le robot « Images du video club » sous nous/bibli-img/ ; ORIG garde l'adresse GitHub en secours.
    var BIBLI_RAW = /^https:\/\/raw\.githubusercontent\.com\/Kinou-DoP\/admin\/main\/data\/bibli\/img\/(.+)$/;
    function ourImg(u) {
      var m = BIBLI_RAW.exec(u || ""); if (!m) return u;
      var t = "https://d3toxii6rvamjf.cloudfront.net/nous/bibli-img/" + m[1]; ORIG[t] = u; return t;
    }
    function thumb(u, w) {
      if (BIBLI_RAW.test(u || "")) return ourImg(u);
      if (/^https:\/\/images\.slatecdn\.net\//.test(u)) { var t = ourThumb(u, w); if (t) return t; }
      return IMG_CDN && /^https:\/\/images\.slatecdn\.net\//.test(u) ? "/.netlify/images?url=" + encodeURIComponent(u) + "&w=" + w + "&q=80&fm=webp" : u;
    }
    // Retouches du video club (edits.json) sur un film d'une page (d = fiche, spotlight ou fiction) : elles passent devant celles de
    // la page (le video club n'enregistre que ce qui diffère des pages). Crédits refaits comme dans les bandes : « Réal », « Prod »,
    // puis « co-DoP Nom » (fiche d'un chef op) ou « DoP Nom » (si le chef op de la page a un autre rôle), puis « Rôle Nom »
    // (ex. Camera operator) ; spotlight / fiction : chefs op sans rôle dans « DoP Nom » (liens), autres rôles dans les crédits.
    function vcApply(p, e, d, ge, mc) {
      // Titre : propre à chaque page (Gus 25/11 : tout passe par le video club « sauf les noms des films ») ; le titre du video club ne vaut que pour les bandes.
      if (e.img) p.img = e.img;
      if (typeof e.full === "string" && e.full) p.full = e.full;
      var sn = vcSnip(e, p.full); if (sn) p.video = sn;
      var ex = e.extras;
      var same = ge && ex && ex.every(function (x) { return x.key; }) && ex.filter(function (x) { return !x.self; }).length === ge.length && ex.every(function (x) { return x.self || ge.some(function (g) { return g.key === x.key; }); });
      if (ge && p.extras && p.extras.length && p.extras.some(function (x) { return x.key; })) { // la page a sa liste (masquées, retirées) : les vidéos du lot y suivent le video club (titres, ordre) sauf ordre choisi sur la page (`extrasOrd`)
        var by = {}; ge.forEach(function (g) { by[g.key] = g; });
        ex = p.extras.map(function (x) { return x.key && by[x.key] ? Object.assign({}, by[x.key], x.hide ? { hide: x.hide } : {}) : x; });
        if (!p.extrasOrd) { var order = ge.map(function (g) { return g.key; }), slots = [], keyed = []; ex.forEach(function (x, i) { if (x.key && order.indexOf(x.key) > -1) { slots.push(i); keyed.push(x); } }); keyed.sort(function (a, b) { return order.indexOf(a.key) - order.indexOf(b.key); }); slots.forEach(function (i, j) { ex[i] = keyed[j]; }); }
      }
      else if (ge && (!ex || ex.every(function (x) { return x.auto; }) || same)) { // pas réglées à la main : les vidéos du même import (masquages gardés)
        var hid = {}; (ex || []).forEach(function (x) { if (x.key && x.hide) hid[x.key] = x.hide; });
        ex = ge.map(function (g) { if (hid[g.key]) g.hide = hid[g.key]; return g; });
      }
      if (ex !== undefined) { p.extras = (ex || []).filter(function (x) { return !x.self && !(x.hide && x.hide.indexOf(d.slug) > -1); }); delete p.stills; delete p.stillsLink; }
      var cl = e.client !== undefined ? e.client : mc; if (cl && e.cshow !== false) p.client = cl; else delete p.client; // client affiché avant le titre : celui de Slate, ou celui de l'admin ; caché si `cshow: false`
      if (e.ipos !== undefined) p.ipos = e.ipos; if (e.ihide) p.ihide = e.ihide.indexOf(d.slug) > -1; // stills et vidéos sous le film ; `hide` = lieux où la ligne est masquée (Gus 26/11)
      // Images d'un projet en images : l'ordre choisi dans le video club vaut partout (Gus 26/11) ; recadrage commun `scrop` { ar, z, x, y }.
      if (e.images && e.images.length) { p.images = e.images; if (p.stills && p.stills.length) p.stills = e.images; }
      if (e.scrop !== undefined) p.scrop = e.scrop || null;
      // Recadrage du video club (Gus 25/11 : une seule source pour fiches et video club) : { z, x, y, t } ; null = aucun.
      if (e.crop !== undefined) { if (e.crop && +e.crop.z > 1) { p.zoom = +e.crop.z; p.zoomPos = (+e.crop.x || 0) + "% " + (+e.crop.y || 0) + "%"; p.zoomThumb = !!e.crop.t; } else { delete p.zoom; delete p.zoomPos; delete p.zoomThumb; } }
      if (!["dir", "prod", "dops", "roles"].some(function (k) { return e[k] !== undefined; })) return;
      var DOP = /^(?:co-)?dop\.?\s+/i, isDop = function (x) { return DOP.test(x); }; // « co-DoP Nom », « DoP Nom », « dop. Nom »
      var l = String(p.sub || "").split("\n").map(function (x) { return x.trim(); });
      var plain = l.filter(function (x) { return x && !isDop(x); }), was = [];
      l.filter(isDop).forEach(function (x) { was = was.concat(x.replace(DOP, "").split(/\s*[,&]\s*/)); });
      var multi = MULTI[d.slug], me = multi ? "" : plainName(d.name);
      var dops = e.dops ? e.dops.slice() : multi ? (p.dps || []).map(function (x) { return x.name; }) : [d.name].concat(was);
      dops = dops.filter(Boolean); var ro = {}; Object.keys(e.roles || {}).forEach(function (n) { if (e.roles[n]) ro[plainName(n)] = e.roles[n]; });
      var main = dops.filter(function (n) { return !ro[plainName(n)]; }), oth = dops.filter(function (n) { return ro[plainName(n)]; });
      var nm = function (n) { return split(n).main; }, lines = [e.dir !== undefined ? e.dir : plain[0] || "", e.prod !== undefined ? e.prod : plain[1] || ""];
      if (multi) { if (e.dops || e.roles) p.dps = main.map(dpByName); }
      else if (ro[me]) { if (main.length) lines.push("DoP " + main.map(nm).join(" & ")); }
      else { var co = main.filter(function (n) { return plainName(n) !== me; }); if (co.length) lines.push("co-DoP " + co.map(nm).join(" & ")); }
      oth.forEach(function (n) { lines.push(ro[plainName(n)] + " " + nm(n)); });
      p.sub = lines.concat(plain.slice(2)).filter(Boolean).join("\n");
    }
    // Fiche JSON -> format interne du prototype (WORK, CATS_BY, ABOUT).
    function register(d) {
      var hue = d.hue || 0;
      var ov = d.overrides || {}; // corrections par clip (cle = id Slate) : title, sub, hidden…
      WORK[d.slug] = (d.clips || []).filter(function (c) { return !(ov[c.slate] && ov[c.slate].hidden); }).map(function (c, i) {
        var p = {}; for (var k in c) p[k] = c[k];
        if (ov[c.slate]) for (k in ov[c.slate]) p[k] = ov[c.slate][k];
        if (d.open !== undefined && c.slate === d.open) p.open = true;
        var e = vcOf(c.slate), ge = vcGroup(c.slate), mc = vcClient(c.slate); if (e || ge || mc) vcApply(p, e || {}, d, ge, mc);
        if (p.extras && p.extras.some(function (x) { return x.hide; })) p.extras = p.extras.filter(function (x) { return !(x.hide && x.hide.indexOf(d.slug) > -1); }); // lignes masquées sur cette page (réglage de la page)
        // Projet en stills avec un extrait vidéo choisi dans l'admin (court métrage sans film ni bande-annonce) :
        // l'extrait joue au survol seulement ; au clic, le lecteur montre la galerie (pas de vidéo).
        if (p.hover && p.hover.video && !p.full && !p.video) { p.video = p.hover.video; p.nosnip = true; }
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
      SHOW[d.slug] = d.showcase || []; // onglets en présentation « vidéo + stills » (interrupteur de l'admin)
      return d;
    }
    var work = document.getElementById("work"), feed = document.getElementById("feed"), cats = document.getElementById("cats"), modes = document.getElementById("modes");
    // Ordinateur (> 900px) : les boutons grille / colonne vont dans le bandeau, hors de la zone qui défile (dont le haut a un
    // fondu qui les effacerait) ; plus étroit : à leur place, au-dessus des films.
    var modesHome = modes.parentNode, modesWide = window.matchMedia("(min-width: 901px)");
    function placeModes() {
      if (modesWide.matches) { if (modes.parentNode !== document.body) document.body.appendChild(modes); }
      else if (modes.parentNode !== modesHome) modesHome.insertBefore(modes, modesHome.firstChild);
    }
    placeModes(); modesWide.addEventListener && modesWide.addEventListener("change", placeModes);
    // Ordinateur : la molette sur le bandeau (nom, onglets, en-tête) fait quand même défiler les films.
    document.addEventListener("wheel", function (e) {
      if (!view || phone.matches || !document.body.classList.contains("has-work") || player.classList.contains("on")) return;
      if (e.ctrlKey || !e.target.closest || e.target.closest(".work, #player, .drawer")) return;
      if (e.target.closest(".cats") && cats.scrollHeight > cats.clientHeight + 1) return; // onglets qui défilent eux-mêmes
      var k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? work.clientHeight : 1;
      work.scrollBy(0, e.deltaY * k);
    }, { passive: true });
    // ABOUT par technicien : bio (un paragraphe par ligne) + liens CV, Instagram, Website. Rempli par register().
    var ABOUT = {};
    var about = document.getElementById("about"), aboutbg = document.getElementById("aboutbg");
    // Fond plein ecran du projet survole (ou selectionne par clic / tap). p.img = visuel du projet.
    var projbg = document.getElementById("projbg"), projvid = document.getElementById("projvid"), selCard = null;
    function bgFor(p, w) {
      if (p.img) { var tu = thumb(p.img, w || GW); return 'linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("' + (GOT[tu] || (ORIG[tu] && !GOT.hasOwnProperty(tu) ? ORIG[tu] : tu)) + '")'; } // l'image qui a marché dans la grille (nôtre ou Slate)
      return "none"; // pas de fond colore provisoire
    }
    // Ignore les cartes masquees sous l'en-tete (zone du titre) quand on a defile.
    function inZone(e) { return e.clientY >= work.getBoundingClientRect().top; }
  // Lecteur par-dessus la galerie / le feed
    var player = document.getElementById("player"), pstage = document.getElementById("pstage"), pcap = document.getElementById("pcap");
    var pglass = document.getElementById("pglass"), ptitle = document.getElementById("ptitle"), pgal = document.getElementById("pgal"), plight = document.getElementById("plight");
    // Films de l'onglet affiché (ordre de la page) : flèches ‹ › du lecteur pour passer au précédent / suivant.
    var playList = [], playIdx = -1, homePlay = false;
    // Films de l'accueil pour le lecteur : film complet et stills pris dans la fiche du chef op (même id Slate)
    // quand la slide n'a pas les siens.
    // Même film ailleurs (Gus 18/11) : fiches des chefs op crédités, puis page fiction et spotlight (même id Slate). On y prend tout
    // ce qui manque à la slide (film complet, stills et vidéos dessous, infos du film, prix, types), sauf l'affiche.
    function homeItem(sl) {
      var title = sl.film + (sl.song ? " · " + sl.song : ""), srcs = [];
      (sl.dps || []).forEach(function (d) { if (d && d.slug && WORK[d.slug]) srcs.push(WORK[d.slug]); });
      [FIC, SPOT].forEach(function (k) { if (WORK[k]) srcs.push(WORK[k]); });
      var sames = [];
      srcs.forEach(function (w) { w.forEach(function (c) { if (c.slate && sl.slate && String(c.slate) === String(sl.slate) && sames.indexOf(c) < 0) sames.push(c); }); });
      function pick(k) { for (var i = 0; i < sames.length; i++) { var v = sames[i][k]; if (v && (!Array.isArray(v) || v.length) && (typeof v !== "object" || Array.isArray(v) || Object.keys(v).length)) return v; } return null; }
      var same = sames[0] || null, xs = pick("extras"), st = pick("stills");
      return { title: title, sub: sl.legend, video: sl.video, full: sl.full || pick("full") || "", nosnip: true, img: sl.img || (same && same.img),
        stills: sl.stills && sl.stills.length ? sl.stills : st,
        extras: sl.extras && sl.extras.length ? sl.extras : sl.stills && sl.stills.length ? null : xs,
        info: sl.info || pick("info") || undefined, types: pick("types") || undefined, platforms: pick("platforms") || undefined,
        h: sl.h, slate: sl.slate, dps: sl.dps, slide: sl };
    }
    function dpFromPlayer(d, a, p) {
      closePlayer(true); if (pushed > 0) pushed--;
      openView({ text: d.name, slug: d.slug, from: "home", rect: a.getBoundingClientRect(), film: p.slide, replaceHistory: true });
    }
    function playHome(slides, i) {
      var need = [];
      slides.forEach(function (sl) { (sl.dps || []).forEach(function (d) { if (d && d.slug) need.push(loadDP(d.slug)); }); });
      need.push(loadDP(FIC), loadDP(SPOT)); // même film sur la page fiction ou le spotlight : infos, prix, stills
      HomeAPI.pause(); homePlay = true;
      Promise.all(need).then(function () {
        var list = slides.map(homeItem);
        openPlayer(list[i], false, list);
      });
    }
    var pprev = document.getElementById("pprev"), pnext = document.getElementById("pnext");
    function stepPlayer(k) { if (playList.length > 1) openPlayer(playList[(playIdx + k + playList.length) % playList.length], true); }
    pprev.addEventListener("click", function () { stepPlayer(-1); });
    pnext.addEventListener("click", function () { stepPlayer(1); });
    // Bouton retour du téléphone / du navigateur : ferme l'image agrandie, puis le lecteur (pas la page).
    var pushed = 0, skipPop = 0;
    function pushStep(url) { history.pushState({ kinou: "player" }, "", url || undefined); pushed++; }
    function popStep() { if (pushed > 0) { pushed--; skipPop++; history.back(); } }
    window.addEventListener("popstate", function (e) {
      if (skipPop) { skipPop--; return; }
      if (pushed > 0) pushed--;
      if (plight.classList.contains("on")) closeStill(true);
      else if (player.classList.contains("on")) closePlayer(true);
      else restorePage(e.state);
    });
    // Adresse d'une page de chef op : #<slug>, ou #<slug>/<categorie> (ex. #lara-…/fashion, #lara-…/about) pour partager
    // directement un onglet. Changer d'onglet met l'adresse à jour sans ajouter d'étape au bouton retour.
    // Affichage (ordinateur) : « /feed » à la fin = une colonne (#lara-…/feed, #lara-…/fashion/feed) ; « /grid » ou rien = grille.
    // Sur téléphone, toujours une colonne (le mot est ignoré).
    function catSlug(c) { return c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
    function parseHash() {
      var h = route().split("/"), m = null, last = (h[h.length - 1] || "").toLowerCase();
      if (h.length > 1 && /^(feed|grid|grille|colonne)$/.test(last)) { m = /^(feed|colonne)$/.test(last) ? "feed" : "gallery"; h.pop(); }
      return { slug: decodeURIComponent(h[0] || ""), cat: (h[1] || "").toLowerCase(), film: decodeURIComponent(h[2] || "").toLowerCase(), mode: m };
    }
    // Adresse d'un film ouvert dans le lecteur : <slug>/<onglet>/<titre> (ex. …/vadim-…/narrative/panda), pour l'envoyer à
    // quelqu'un ; « featured » pour l'onglet d'arrivée (ALL du spotlight, NEW RELEASES de la fiction). Fermer le lecteur (croix,
    // bouton retour) remet l'adresse de la page (Gus 30/10). Films de l'accueil et images cliquées : l'adresse ne change pas.
    // Titre affiché (Gus 26/11) : « Client | Titre » quand le client est affiché (admin : case « afficher avant le titre ») ; l'adresse garde le titre seul.
    function dtitle(p) { return p.client ? p.client + " | " + p.title : p.title; }
    function filmSlug(p) { return catSlug((p.title || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")) || String(p.slate || ""); }
    function tabFilms(slug, cat) {
      var l = (WORK[slug] || []).filter(function (p) { return cat === "FEATURED" ? p.f : p.cat === cat; }).sort(function (a, b) { return cat === "FEATURED" ? (a.fo || 0) - (b.fo || 0) : 0; });
      if (cat === "FEATURED") { var seenF = {}; l = l.filter(function (p) { var k = p.slate || "t" + p.title; if (seenF[k]) return false; seenF[k] = 1; return true; }); } // un film dans plusieurs catégories (une entrée chacune) n'apparaît qu'une fois dans FEATURED
      if (slug === FIC && cat === "COMING SOON") l.reverse(); // fiction : ordre inverse de la bande (prochaine sortie en premier)
      return l;
    }
    // Ctrl / Cmd + clic (ou clic molette) sur un film : son adresse dans un nouvel onglet.
    function filmTab(p) { var u = filmURL(p); if (u) window.open(u, "_blank", "noopener"); }
    function filmURL(p) {
      if (!view || !WORK[view.o.slug] || tabFilms(view.o.slug, curCat).indexOf(p) < 0) return null;
      return pageURL(view.o.slug + "/" + catSlug(curCat) + "/" + filmSlug(p));
    }
    // Arrivée par l'adresse d'un film : la page s'ouvre sur son onglet, puis le lecteur sur ce film.
    function openFilmLater(slug, film) {
      var t0 = Date.now();
      setTimeout(function tryOpen() {
        if (!view || view.o.slug !== slug || Date.now() - t0 > 8000) return;
        if (!WORK[slug] || !feed.children.length) { setTimeout(tryOpen, 150); return; }
        var list = tabFilms(slug, curCat), p = list.filter(function (x) { return filmSlug(x) === film || String(x.slate) === film; })[0];
        if (p) openPlayer(p, false, feed.classList.contains("showcase") ? list.filter(hasFilm) : list);
      }, 300);
    }
    function tabUrl(slug, c) {
      // « /feed » si choisi ; « /grid » seulement sur un onglet « vidéo + stills » (dont l'affichage par défaut est le feed).
      var m = view && view.o.mode, suf = m === "feed" && !showTab(slug, c) ? "/feed" : m === "gallery" && showTab(slug, c) ? "/grid" : "";
      try { history.replaceState({ k: "dp", slug: slug }, "", pageURL(slug + (c && c !== "FEATURED" ? "/" + catSlug(c) : "") + suf)); } catch (e) {}
    }
    // Affichage voulu : une colonne sur téléphone ; sinon celui de l'adresse ou du bouton choisi (grille par défaut).
    function wantMode() { return phone.matches ? "feed" : (view && view.o.mode) || "gallery"; }
    // Pages du site dans l'historique (accueil, liste, page d'un chef op) : le bouton retour revient à la précédente.
    function pushPage(st) {
      try { history.pushState(st, "", pageURL(st.k === "dp" ? st.slug : st.k === "list" ? LIST : "")); } catch (e) {}
    }
    function restorePage(st) {
      if (st && st.kinou) return; // entrée du lecteur (bouton « suivant » du navigateur) : rien à faire
      if (!st || !st.k) st = route() === LIST ? { k: "list" } : route() ? { k: "dp", slug: parseHash().slug, cat: parseHash().cat, film: parseHash().film, mode: parseHash().mode } : { k: "home" };
      if (st.k === "dp") {
        if (view && view.o.slug === st.slug) { // même page, autre onglet ou autre affichage (adresse modifiée à la main)
          var tb = st.cat && [].filter.call(cats.querySelectorAll("button"), function (x) { return catSlug(x.dataset.cat) === st.cat; })[0];
          if (tb && !tb.classList.contains("on")) tb.click();
          var mb = st.mode && !phone.matches && modes.querySelector('button[data-mode="' + st.mode + '"]');
          if (mb && st.mode !== mode) mb.click();
          return;
        }
        if (view) closeView(true);
        if (PAGES[st.slug]) { openPage(st.slug, null, { noHistory: true, cat: st.cat, mode: st.mode }); if (st.film) openFilmLater(st.slug, st.film); return; }
        var a = document.querySelector('li a[data-view="' + st.slug + '"]');
        if (!a) return;
        if (document.body.classList.contains("is-home")) show("list");
        openView({ text: a.textContent, slug: st.slug, from: "list", a: a, instant: true, noHistory: true, cat: st.cat, mode: st.mode });
        if (st.film) openFilmLater(st.slug, st.film);
        return;
      }
      if (view) closeView(); // le nom repart à sa place (accueil ou liste)
      var home = document.body.classList.contains("is-home");
      if (st.k === "home" && !home) show("home");
      if (st.k === "list" && home) show("list");
    }
    function openPlayer(p, keep, list) {
      if (!keep) {
        playList = list || [].map.call(feed.querySelectorAll(".card"), function (c) { return c._p; });
        if (!player.classList.contains("on")) pushStep(filmURL(p));
      }
      if (keep || player.classList.contains("on")) { var fu = filmURL(p); if (fu && pushed > 0) { try { history.replaceState({ kinou: "player" }, "", fu); } catch (e) {} } }
      playIdx = playList.indexOf(p);
      player.classList.toggle("has-nav", playList.length > 1 && playIdx > -1);
      projvid.pause(); pauseSnips();
      pstage.textContent = ""; pcap.textContent = "";
      // Fiction : l'affiche à gauche du film (à la même hauteur), les stills dessous.
      player.classList.toggle("has-poster", !!p.poster);
      // Téléphone : l'affiche en petit, à gauche des crédits (.pposter-s), plutôt qu'au-dessus du film.
      if (p.poster) {
        var pp = document.createElement("img"); pp.className = "pposter"; pp.src = dataURL(p.poster); pp.alt = ""; pstage.appendChild(pp);
        var ps = pp.cloneNode(); ps.className = "pposter-s"; pcap.appendChild(ps);
      }
      var src = p.full || (p.nosnip ? "" : p.video); // film complet (avec son) ; l'extrait seulement hors accueil
      // Projet en images avec une seule image : elle s'affiche en grand, à la place du film, pas en galerie d'une case (Gus 03/11).
      var own = p.stills && p.stills.length ? p.stills : p.images && p.images.length ? p.images : [];
      var solo = !src && p._big === undefined && own.length === 1 ? own[0] : null;
      pstage.style.backgroundImage = src || solo || p._big !== undefined ? "none" : bgFor(p); // vidéo, ou image cliquée (présentation vidéo + stills) : fond noir (sinon l'image apparaît en double autour)
      if (src) {
        var v = document.createElement("video");
        v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = "auto";
        if (p.img) v.poster = ourImg(p.img);
        v.src = src; pstage.appendChild(v);
        var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
      } else if (solo) {
        var im1 = document.createElement("img"); im1.src = solo; im1.alt = p.title; im1.className = "pbig"; pstage.appendChild(im1);
        im1.addEventListener("click", function () { showStill(0); });
      } else if (p.img) {
        var im = document.createElement("img"); im.src = thumb(p.img, FW); im.alt = p.title; pstage.appendChild(im); // notre version réduite (1600), l'originale en secours
        // Image d'une présentation « vidéo + stills » : clic = en plein écran (flèches : toute la galerie).
        if (p._big !== undefined) { im.className = "pbig"; im.addEventListener("click", function () { showStill(p._big); }); }
      }
      ptitle.textContent = dtitle(p);
      // Depuis l'accueil : nom du ou des chefs op, en blanc, liens vers leur page (spotlight : dernière ligne, « DoP Nom »).
      if (p.dps && p.dps.length && view && MULTI[view.o.slug]) { var spotDps = true; }
      else if (p.dps && p.dps.length) {
        var who = document.createElement("div"); who.className = "pdps";
        p.dps.forEach(function (d, k) {
          if (k) who.appendChild(document.createTextNode(" & "));
          var a = document.createElement(d.slug ? "a" : "span"); a.textContent = split(d.name).main;
          if (d.slug) { a.href = pageURL(d.slug); a.addEventListener("click", function (e) { if (newTab(e)) return; e.preventDefault(); dpFromPlayer(d, a, p); }); }
          who.appendChild(a);
        });
        pcap.appendChild(who);
      }
      // Films Narrative : leurs types de contenu en bas à droite de la vidéo (comme sur la vignette ; Gus 29/10).
      var plab = narrTypes(p); if (plab.length && curCat === "FEATURED") plab = [p.cat].concat(plab);
      if (plab.length) { var pt = document.createElement("span"); pt.className = "ptypes"; pt.textContent = plab.join(" · "); pcap.insertBefore(pt, pcap.firstChild); }
      var s = document.createElement("p"); s.textContent = p.sub || p.cat; pcap.appendChild(s);
      if (spotDps) pcap.appendChild(dpLine(p, "pdop", true));
      fillInfo(p);
      buildStills(p, src, solo);
      player.scrollTop = 0;
      player.classList.add("on"); pglass.classList.add("on"); preSuite(); // préchargements en fond arrêtés (reprise à la fermeture)
    }
    // Infos d'un film (admin, overrides[<id>].info, Gus 04/11), sous les crédits : « 2025 | 90 min | 1.85 | Netflix » et
    // caméra / optiques à gauche, prix & sélections à droite (en blanc), synopsis dessous (en gris). Rien si aucune info.
    var pinfo = document.createElement("div"); pinfo.className = "pinfo"; pcap.parentNode.insertBefore(pinfo, pcap.nextSibling);
    function specOf(p) {
      var f = p.info || {}, d = String(f.runtime || "").trim();
      if (/^\d+$/.test(d)) d += " min";
      if (f.episodes) d = f.episodes + " episode" + (+f.episodes > 1 ? "s" : "") + (d ? " · " + d : "");
      return [f.year, d, f.ratio, f.platforms || (p.platforms || []).join(", ")].filter(Boolean);
    }
    function fillInfo(p) {
      var f = p.info || {}, spec = specOf(p);
      pinfo.textContent = "";
      function el2(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
      var a = el2("div", "pi-a"), b = el2("div", "pi-b");
      if (spec.length) {
        var l = el2("p", "pi-line");
        spec.forEach(function (x, i) { if (i) l.appendChild(el2("i", "", "|")); l.appendChild(document.createTextNode(x)); });
        a.appendChild(l);
      }
      // Starring (Gus 18/11) : quelques acteurs, avant caméra / optiques, même présentation (étiquette grise en majuscules).
      if (f.starring) { var stp = el2("p", "pi-tech pi-star"), sw = el2("span", "", ""); sw.appendChild(el2("b", "", "Starring")); sw.appendChild(document.createTextNode(String(f.starring).trim())); stp.appendChild(sw); a.appendChild(stp); }
      if (f.camera || f.lenses) {
        var t = el2("p", "pi-tech");
        [["Camera", f.camera], ["Lenses", f.lenses]].forEach(function (x) { if (!x[1]) return; var w = el2("span", "", ""); w.appendChild(el2("b", "", x[0])); w.appendChild(document.createTextNode(x[1])); t.appendChild(w); });
        a.appendChild(t);
      }
      var aw = String(f.awards || "").split(/\n+/).map(function (x) { return x.replace(/\s*[–—]\s*/g, " • ").trim(); }).filter(Boolean); // tirets longs → « • » (Gus 18/11)
      // Prix groupés par festival (Gus 18/11) : nom du festival + année en petites capitales grises, puis les prix en blanc,
      // les nominations et sélections dessous, précédées d'une petite étiquette (« Nominee », « Official Selection »).
      // Lignes écrites par l'admin (awLine) : « Prix, Festival 2026 », « Nominated, Prix, Festival 2026 »,
      // « Official selection – Section, Festival 2026 » ; une ligne d'une autre forme est affichée telle quelle.
      if (aw.length) {
        var ul = el2("ul", "pi-awards"), groups = [], byF = {};
        aw.forEach(function (x) {
          var m = x.match(/^(.*\S),\s*([^,]*?\S)\s+((?:19|20)\d\d)$/), g = { fest: "", items: [] }, it = { kind: "win", text: x };
          if (m) {
            g = byF[m[2] + " " + m[3]] || (byF[m[2] + " " + m[3]] = { fest: m[2], year: m[3], items: [] });
            var h = m[1], n = h.match(/^nominated?\s*(?:[,:•–-]\s*)?(.*)$/i), sl = h.match(/^((?:official\s+)?selection|shortlist(?:ed)?)\s*(?:[,:•–-]\s*)?(.*)$/i);
            it = n ? { kind: "nom", tag: "Nominee", text: n[1] } : sl ? { kind: "sel", tag: /^short/i.test(sl[1]) ? "Shortlist" : "Official Selection", text: sl[2] } : { kind: "win", text: h };
          }
          if (groups.indexOf(g) < 0) groups.push(g);
          g.items.push(it);
        });
        var rank = { win: 0, nom: 1, sel: 2 };
        groups.forEach(function (g) {
          var li = el2("li", "aw");
          if (g.fest) { var fe = el2("span", "aw-fest", g.fest); fe.appendChild(el2("i", "", g.year)); li.appendChild(fe); }
          g.items.slice().sort(function (a, b2) { return rank[a.kind] - rank[b2.kind]; }).forEach(function (it) {
            var r = el2("span", "aw-it " + it.kind);
            if (it.tag) r.appendChild(el2("b", "", it.tag));
            if (it.text) r.appendChild(document.createTextNode(it.text));
            li.appendChild(r);
          });
          ul.appendChild(li);
        });
        b.appendChild(ul);
      }
      // Ordinateur : rien au-dessus des prix dans leur colonne → ils remontent à droite, à la hauteur des crédits (réal, prod), sous
      // les types du film s'il y en a (Gus 18/11 : même s'il y a des infos à gauche) ; année, durée, caméra… restent à gauche, sous
      // les crédits (`.pi-a` mis dans `.pcap`, à côté des prix). Téléphone et tablette : une colonne collée à gauche, prix juste sous les crédits.
      if (aw.length && !matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)").matches) {
        ul.classList.add("pi-up"); var pt0 = pcap.querySelector(".ptypes");
        pcap.insertBefore(ul, pt0 ? pt0.nextSibling : pcap.firstChild); b = el2("div");
        if (a.children.length) { a.classList.add("pi-in"); pcap.appendChild(a); a = el2("div"); }
      }
      if (a.children.length) pinfo.appendChild(a);
      if (b.children.length) pinfo.appendChild(b);
      // Synopsis français (synopsis) et anglais (synopsisEn) : un seul renseigné = lui seul ; les deux = anglais d'abord, choix EN / FR
      // comme pour les bios (même mémoire du choix, « kinou-lang » ; Gus 04/11).
      function paras(t) { return String(t || "").split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
      var fr = paras(f.synopsis), en = paras(f.synopsisEn);
      if (fr.length || en.length) {
        var sy = el2("div", "pi-syn"), txt = el2("div"), lang = en.length ? "en" : "fr";
        if (en.length && fr.length) {
          try { if (localStorage.getItem("kinou-lang") === "fr") lang = "fr"; } catch (e) {}
          var tg = el2("div", "lang");
          ["en", "fr"].forEach(function (l) {
            var bt = el2("button", l === lang ? "on" : "", l.toUpperCase()); bt.type = "button"; bt.setAttribute("aria-label", l === "fr" ? "Français" : "English");
            bt.addEventListener("click", function () {
              lang = l; try { localStorage.setItem("kinou-lang", l); } catch (e) {}
              tg.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === bt); }); fillSyn();
            });
            tg.appendChild(bt);
          });
          sy.appendChild(tg);
        }
        var fillSyn = function () { txt.textContent = ""; (lang === "en" ? en : fr).forEach(function (x) { txt.appendChild(el2("p", "", x)); }); };
        fillSyn(); sy.appendChild(txt); pinfo.appendChild(sy);
      }
      pinfo.hidden = !pinfo.children.length;
    }
    // Sous les credits, dans l'ordre de l'admin (p.extras) : galeries de stills et autres videos.
    // Ancien format : p.stills seul. Projet sans film : ses images (p.stills) d'abord, puis les extras.
    function blocksOf(p, src) {
      var b = (p.extras || []).filter(function (x) { return (x.stills && x.stills.length) || x.full || x.video; });
      // p.images : images d'un projet en images seulement, ajoutées par le robot GitHub de l'admin (lues sur Slate).
      var own = p.stills && p.stills.length ? p.stills : !src && p.images && p.images.length ? p.images : null;
      if (p.ihide) own = null; // images du projet masquées sur cette page (admin)
      var st = own ? [{ stills: own, crop: p.scrop || null }] : [];
      if (!p.extras) return st;
      if (src || !st.length) return b;
      var at = Math.max(0, Math.min(+p.ipos || 0, b.length)); // images du projet placées parmi les lignes (admin, glisser)
      return b.slice(0, at).concat(st, b.slice(at));
    }
    // Chaque element apparait en arrivant a l'ecran ; un clic sur une image l'agrandit (fleches : toutes les images).
    var stillsP = null, stillsIdx = 0;
    var seen = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { seen.unobserve(e.target); reveal(e.target); } });
    }, { root: player }) : null;
    function buildStills(p, src, solo) {
      if (seen) seen.disconnect();
      pgal.textContent = ""; if (plight.classList.contains("on")) closeStill();
      var blocks = blocksOf(p, src), all = [], order = [], run = ++galRun;
      var crops = []; stillsP = { title: p.title, stills: all, crops: crops };
      // Image seule déjà en grand : pas répétée dessous, mais agrandie au clic (1re image de la visionneuse).
      if (solo && blocks[0] && blocks[0].stills && blocks[0].stills.length === 1 && blocks[0].stills[0] === solo) { all.push(solo); blocks = blocks.slice(1); }
      player.classList.toggle("has-stills", blocks.length > 0);
      // Projet sans film qui commence par des stills : pas de grande image, la galerie directement sous le titre.
      player.classList.toggle("nostage", !src && !solo && p._big === undefined && !!(blocks[0] && blocks[0].stills));
      // Vidéos en colonnes (Gus 18/11) : `cols: { d, m }` sur une vidéo (admin, « + ») = 1 à 3 colonnes sur ordinateur / téléphone ;
      // les vidéos suivantes sans réglage s'y rangent aussi, jusqu'à des stills ou une vidéo qui a son propre réglage.
      var row = null;
      blocks.forEach(function (x) {
        if (x.stills && x.stills.length) row = null;
        else if (x.cols) {
          var d = Math.min(3, Math.max(1, +x.cols.d || 1)), m = Math.min(3, Math.max(1, +x.cols.m || 1));
          if (d === 1 && m === 1) row = null;
          else { row = document.createElement("div"); row.className = "pxrow"; row.style.setProperty("--xd", d); row.style.setProperty("--xm", m); if (d > 1) row.classList.add("multi"); if (m > 1) row.classList.add("mmulti"); pgal.appendChild(row); }
        }
        if (x.stills && x.stills.length) {
          var g = document.createElement("div"); g.className = "pgrid"; pgal.appendChild(g);
          x.stills.forEach(function (u, i) {
            var cr = cropOf(x.crop, u); // recadrage du groupe (ou propre à cette image), réglé dans l'admin
            var k = all.push(u) - 1, b = document.createElement("button"); crops[k] = cr;
            if (cr) { b.className = "cr"; cropVars(b, cr); b.appendChild(document.createElement("i")); }
            b.dataset.src = thumb(u, GW);
            b.style.setProperty("--i", i % 3);
            b.setAttribute("aria-label", "Image " + (k + 1));
            b.addEventListener("click", function () { showStill(k); });
            g.appendChild(b);
            order.push({ src: b.dataset.src, el: b });
          });
          return;
        }
        var w = document.createElement("div"); w.className = "pxv";
        if (x.title) { var t = document.createElement("h3"); t.className = "ptitle"; t.textContent = x.title; w.appendChild(t); }
        var v = document.createElement("video");
        v.controls = true; v.playsInline = true; v.preload = "metadata";
        if (x.img) v.poster = ourImg(x.img);
        v.src = x.full || x.video; w.appendChild(v); (row || pgal).appendChild(w);
        if (seen) seen.observe(w); else reveal(w);
      });
      orderedLoad(order, function (it) { it.el.style.backgroundImage = 'url("' + it.src + '")'; it.el.classList.add("shown"); },
        function () { return run === galRun && player.classList.contains("on"); });
    }
    // Une seule video du lecteur joue a la fois (film et videos du dessous).
    player.addEventListener("play", function (e) {
      [].forEach.call(player.querySelectorAll("video"), function (v) { if (v !== e.target) v.pause(); });
    }, true);
    // L'image monte une fois chargee (pas de case vide qui apparait) ; une video monte tout de suite.
    // Images d'une galerie chargées dans l'ordre (4 d'avance au plus) et affichées dans l'ordre : plus de « trous » quand
    // les dernières arrivent avant les premières (Gus 03/11). alive() faux = galerie fermée / remplacée : on arrête.
    function orderedLoad(items, show, alive) {
      var next = 0, done = 0;
      function pump() { while (next < items.length && next - done < 4) load(items[next++]); }
      function load(it) { loadImg(it.src, function (u) { it.src = u; it.ok = true; flush(); }); }
      function flush() { if (!alive()) return; while (done < items.length && items[done].ok) show(items[done++]); pump(); }
      pump();
    }
    var galRun = 0;
    function reveal(b) {
      if (b.classList.contains("pxv")) { b.classList.add("shown"); return; }
      loadImg(b.dataset.src, function (u) { (b.classList.contains("cr") ? b.firstChild : b).style.backgroundImage = 'url("' + u + '")'; b.classList.add("shown"); });
    }
    // Recadrage de stills (admin : « ▣ ») : { l, t, w, h, ar } = rectangle (fraction de l'image) qui remplit un cadre de forme `ar` ;
    // `per[adresse]` = recadrage propre à une image ; ancien format { ar, z, x, y } (zoom depuis un point) encore lu.
    function cropOf(c, u) {
      if (c && c.per && u && c.per[u]) c = c.per[u];
      if (!c) return null;
      if (+c.w > 0 && +c.h > 0 && +c.ar > 0) return { ar: +c.ar, w: +c.w, h: +c.h, l: +c.l || 0, t: +c.t || 0 };
      if (+c.ar > 0) return { ar: +c.ar, z: Math.max(1, +c.z || 1), x: c.x === undefined ? 50 : +c.x, y: c.y === undefined ? 50 : +c.y };
      return null;
    }
    function cropVars(el, c) {
      el.style.setProperty("--sar", c.ar);
      if (c.w) {
        el.style.setProperty("--bsz", 100 / c.w + "% " + 100 / c.h + "%");
        el.style.setProperty("--bpos", (c.w < 1 ? c.l / (1 - c.w) * 100 : 0) + "% " + (c.h < 1 ? c.t / (1 - c.h) * 100 : 0) + "%");
      } else { el.style.setProperty("--sz", c.z); el.style.setProperty("--sx", c.x + "%"); el.style.setProperty("--sy", c.y + "%"); }
    }
    var plimg = document.getElementById("plimg");
    function showStill(i) {
      var n = stillsP.stills.length; i = (i + n) % n;
      plimg.textContent = "";
      var cr = stillsP.crops && stillsP.crops[i];
      if (cr) { var w = document.createElement("div"); w.className = "plcr"; cropVars(w, cr); var iy = document.createElement("i"); iy.style.backgroundImage = 'url("' + ourImg(stillsP.stills[i]) + '")'; iy.setAttribute("role", "img"); iy.setAttribute("aria-label", stillsP.title || ""); w.appendChild(iy); plimg.appendChild(w); }
      else { var im = document.createElement("img"); im.src = ourImg(stillsP.stills[i]); im.alt = stillsP.title; plimg.appendChild(im); }
      if (!plight.classList.contains("on")) pushStep();
      plight.classList.toggle("multi", n > 1);
      stillsIdx = i; plight.classList.add("on");
    }
    function closeStill(fromBack) {
      plight.classList.remove("on"); if (!fromBack) popStep();
      if (player.classList.contains("photo-only")) player.classList.remove("on", "photo-only"); // photo d'une catégorie de photos
    }
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
      player.classList.remove("on"); pglass.classList.remove("on");
      if (!fromBack) popStep();
      pstage.textContent = "";
      [].forEach.call(pgal.querySelectorAll("video"), function (v) { v.pause(); });
      if (document.body.classList.contains("proj-on") && projvid.classList.contains("on")) { var pr = projvid.play(); if (pr && pr.catch) pr.catch(function () {}); }
      if (liveSeen) feed.querySelectorAll("video.live[src]").forEach(function (v) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); });
      if (homePlay) { homePlay = false; if (!view && document.body.classList.contains("is-home")) HomeAPI.resume(); }
    }
    player.addEventListener("click", function (e) { if (e.target === player || e.target === pgal || e.target.classList.contains("pin") || e.target.closest(".pclose")) closePlayer(); });
    // Fond qui joue un passage HD de l'accueil (p.seg = [début, fin]) : en boucle sur ce passage, jamais au-delà.
    projvid.addEventListener("timeupdate", function () { var g = projvid._seg; if (g && (projvid.currentTime >= g[1] || projvid.currentTime < g[0] - 1)) { try { projvid.currentTime = g[0]; } catch (e) {} } });
    function showProj(p, t) {
      projvid._seg = p.seg || null;
      projbg.style.backgroundImage = bgFor(p, 64); // fond flou : une toute petite image agrandie (leger a afficher)
      if (p.video && t !== undefined) {
        if (projvid.dataset.src !== p.video) { projvid.src = p.video; projvid.dataset.src = p.video; }
        if (t) { try { projvid.currentTime = t; } catch (e) {} }
        projvid.classList.add("on");
        var pr = projvid.play(); if (pr && pr.catch) pr.catch(function () {});
      } else { projvid.classList.remove("on"); projvid.pause(); }
      document.body.classList.add("proj-on");
    }
    function clearProj() { dropAuto(); if (selCard) selCard.classList.remove("sel"); selCard = null; projvid.classList.remove("on"); projvid.pause(); document.body.classList.remove("proj-on"); }
    var mode = "gallery", curCat = "FEATURED";
    // Sur téléphone, toujours en feed (la grille est trop petite) : pas de choix d'affichage.
    var phone = window.matchMedia("(max-width: 700px)");
    phone.addEventListener && phone.addEventListener("change", function () {
      if (view && WORK[view.o.slug] && !work.classList.contains("about-mode")) { mode = wantMode(); render(view.o.slug, curCat, 0); }
    });
    // Onglets en boucle (téléphone) : recalculés quand la largeur change (rotation, fenêtre redimensionnée).
    var marqueeT = 0;
    window.addEventListener("resize", function () {
      if (!tabSet || !document.body.classList.contains("viewing")) return;
      clearTimeout(marqueeT); marqueeT = setTimeout(marquee, 200);
    });
    // Au survol d'un projet : la vignette joue un extrait video muet ; le fond plein ecran reste l'image fixe
    var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Version « live » (adresse …/site/live ou ?live) : chaque vignette joue son extrait en boucle (sans son), seulement
    // quand elle est à l'écran. Même site, même code : seul cet interrupteur change ; l'adresse normale reste en vignettes fixes.
    // Sur téléphone (≤ 700px), toujours : les extraits tournent tout le temps (demande de Gus, 24/10) ; ordinateur inchangé.
    var LIVE = /[?&]live\b/.test(location.search);
    function liveOn() { return LIVE || phone.matches || !!(view && view.o.slug === SPOT); } // spotlight : toujours en boucle
    var liveSeen = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target.querySelector("video.live"); if (!v) return;
        if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        else v.pause();
      });
    }, { root: work, rootMargin: "200px 0px" }) : null;
    function liveThumb(st, p) {
      if (!liveSeen || !liveOn() || !p.video || reduceMotion) return;
      var v = document.createElement("video");
      v.className = "snip live"; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "none"; v.dataset.src = p.video;
      v.addEventListener("playing", function () { v.classList.add("on"); });
      st.appendChild(v); liveSeen.observe(st);
    }
    function snip(st, p, on) {
      if (liveSeen && liveOn()) return; // version live / téléphone : les extraits jouent déjà tous
      var v = st.querySelector("video.snip");
      if (!on) {
        if (v) {
          v.pause(); v.classList.remove("on"); clearTimeout(st._vt); st.classList.remove("vidon");
          // Libere la video (memoire, decodeur) une fois le fondu termine, si on n'est pas revenu dessus.
          v._free = setTimeout(function () { v.removeAttribute("src"); v.load(); v.remove(); }, 600);
        }
        return;
      }
      if (v && v._free) { clearTimeout(v._free); v._free = null; }
      var vsrc = p.video; // extrait d'apercu seulement (le film complet, trop lourd, est reserve au lecteur)
      if (!vsrc || reduceMotion || (navigator.connection && navigator.connection.saveData)) return;
      if (!v) {
        // Extrait Slate en entier et en boucle (il est monté pour boucler ; ne pas le couper).
        v = document.createElement("video"); v.className = "snip"; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
        // Affichée seulement quand sa première image est vraiment peinte (sinon l'image fixe et l'extrait se mélangent un instant).
        // Une fois l'extrait entièrement apparu, l'image fixe dessous est retirée (.vidon) : sinon, page zoomée, son bord clair
        // se voit autour de l'extrait (les deux ne s'arrondissent pas au même pixel).
        var shown = function () { v.classList.add("on"); clearTimeout(st._vt); st._vt = setTimeout(function () { if (v.classList.contains("on")) st.classList.add("vidon"); }, 250); };
        v.addEventListener("playing", function () { if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(shown); else shown(); });
        // Vidéo arrêtée ou vidée (onglet du navigateur en arrière-plan, mémoire libérée…) : l'image fixe revient tout de suite,
        // sinon la vignette restait noire au retour sur la page.
        ["pause", "emptied", "waiting", "error"].forEach(function (ev) { v.addEventListener(ev, function () { clearTimeout(st._vt); st.classList.remove("vidon"); }); });
        v.src = vsrc; st.appendChild(v);
      }
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
    }
    // Page cachée (autre onglet, ordinateur en veille) : images fixes remises sous les extraits ; au retour, retirées de nouveau
    // une fois l'extrait réellement affiché.
    document.addEventListener("visibilitychange", function () {
      document.querySelectorAll(".still.vidon").forEach(function (st) { st.classList.remove("vidon"); });
      if (document.hidden) return;
      document.querySelectorAll("video.snip.on").forEach(function (v) {
        if (v.paused || !v.requestVideoFrameCallback) return;
        var st = v.parentNode; v.requestVideoFrameCallback(function () { if (v.classList.contains("on") && !document.hidden) st.classList.add("vidon"); });
      });
    });
    function pauseSnips() { document.querySelectorAll("video.snip").forEach(function (v) { v.pause(); }); }
    var touchOnly = window.matchMedia("(hover: none)"), focusCard = null, focusRaf = 0;
    function pickFocus(sizesOnly) {
      if (sizesOnly !== true) focusRaf = 0;
      if (!touchOnly.matches || work.classList.contains("about-mode") || player.classList.contains("on")) return;
      if (feed.classList.contains("showcase")) { if (sizesOnly !== true) scFocus(); return; } // présentation vidéo + stills
      // Repère à 40 % de la hauteur, mais près du haut de la page il descend avec le défilement depuis le centre du
      // 1er film : tout en haut, c'est toujours le 1er film (le plus important) qui est choisi.
      var r = work.getBoundingClientRect(), best = null, bd = 1e9, f1 = feed.querySelector(".card .still");
      var line = r.top + r.height * 0.4;
      if (f1) { var b1 = f1.getBoundingClientRect(); line = Math.min(line, (b1.top + b1.bottom) / 2 + work.scrollTop); }
      // Même chose en bas : en approchant de la fin, le repère descend vers le dernier film (choisi tout en bas),
      // ce qui évite un grand espace vide sous la liste.
      var fl = feed.querySelectorAll(".card .still"), ln = fl[fl.length - 1];
      // (seulement dans la 2e moitié du défilement : en haut, c'est toujours le 1er film, même avec 2 films.)
      if (ln && ln !== f1) { var bl = ln.getBoundingClientRect(), left = work.scrollHeight - work.clientHeight - work.scrollTop; if (left < work.scrollTop) line = Math.max(line, (bl.top + bl.bottom) / 2 - 2 * left); }
      var cards = feed.querySelectorAll(".card"), sizes = [];
      cards.forEach(function (c) {
        var b = c.querySelector(".still").getBoundingClientRect(), d = Math.abs((b.top + b.bottom) / 2 - line);
        if (b.bottom > r.top && d < bd) { bd = d; best = c; }
        // Perspective : plus un film est loin du repère, plus il est petit (au plus -13 %, à une demi-hauteur d'écran).
        sizes.push(1 - 0.13 * Math.min(1, d / (r.height * 0.5)));
      });
      // Propriété « scale » (pas « transform ») : elle s'ajoute à l'animation d'arrivée au lieu d'attendre sa fin.
      cards.forEach(function (c, i) { c.style.scale = sizes[i].toFixed(4); }); // écrit après toutes les lectures
      if (sizesOnly === true || best === focusCard) return;
      if (focusCard) { focusCard.classList.remove("focus"); snip(focusCard.querySelector(".still"), focusCard._p, false); }
      focusCard = best;
      if (best) { best.classList.add("focus"); showProj(best._p); snip(best.querySelector(".still"), best._p, true); }
    }
    work.addEventListener("scroll", function () { if (!focusRaf) focusRaf = requestAnimationFrame(pickFocus); }, { passive: true });
    // Sur ordinateur, en arrivant sur un onglet : le 1er film est déjà « survolé » (extrait + fond flou), pour ne pas
    // arriver sur une page figée ; dès qu'on survole un film, tout redevient normal (autoCard oublié).
    var autoCard = null, renderRun = 0;
    function autoFirst(run) {
      if (run !== renderRun || touchOnly.matches || selCard || player.classList.contains("on") || work.classList.contains("about-mode")) return;
      if (feed.querySelector(".card:hover")) return;
      var c = feed.querySelector(".card"); if (!c) return;
      autoCard = c; showProj(c._p); snip(c.querySelector(".still"), c._p, true);
    }
    // Téléphone, fiction : les genres de PAST RELEASES sur une 2e ligne, sous les onglets (qui défilent). Boutons relais :
    // un clic = clic sur le vrai genre de .cats (caché sur téléphone) ; apparition animée (CSS, body.subs-on).
    var subcats = document.getElementById("subcats");
    function subRow(slug, cat) {
      if (slug !== FIC || PAST.indexOf(cat) < 0) { subcats.textContent = ""; document.body.classList.remove("subs-on"); return; }
      if (!subcats.children.length) FIC_GENRES.forEach(function (g) {
        if (!cats.querySelector('button.sub[data-cat="' + g + '"]')) return; // genre sans film : pas d'onglet
        var b = document.createElement("button"); b.textContent = g; b.dataset.cat = g; b.style.setProperty("--i", subcats.children.length);
        b.addEventListener("click", function () { var o = cats.querySelector('button.sub[data-cat="' + g + '"]:not([aria-hidden])'); if (o) o.click(); });
        subcats.appendChild(b);
      });
      subcats.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x.dataset.cat === cat); });
      document.body.classList.add("subs-on");
    }
    function dropAuto(keep) {
      if (!autoCard) return;
      if (autoCard !== keep) { snip(autoCard.querySelector(".still"), autoCard._p, false); }
      autoCard = null;
    }
    function typesOf(p) {
      var seen = { narrative: 1, stills: 1, fiction: 1, trailer: 1, "bande annonce": 1, "bande-annonce": 1 }; // jamais affichés (Gus 29/10)
      // « Short Film Trailer » → « Short Film » (mots bannis retirés aussi à l'intérieur d'un type), puis sans doublon.
      return (p.types || []).map(function (t) { return String(t).replace(/\b(trailer|bande[- ]annonce)\b/gi, "").replace(/\s+/g, " ").trim(); })
        .filter(function (t) { var k = t.toLowerCase(); if (!k || seen[k]) return false; seen[k] = 1; return true; });
    }
    function narrTypes(p) { return /narrative/i.test(p.cat || "") ? typesOf(p) : []; }
    // Onglet en présentation « vidéo + stills » (interrupteur de l'admin) : c'est son affichage « feed » (par défaut) ; le bouton
    // grille de l'ordinateur le remet en grille habituelle (Gus 30/10).
    function showTab(slug, cat) { return !MULTI[slug] && (SHOW[slug] || []).indexOf(cat) > -1; }
    function render(slug, cat, delay) {
      // Affichage par défaut (rien choisi dans l'adresse ni avec les boutons) : feed (= présentation) sur ces onglets, grille ailleurs.
      if (!phone.matches && view && view.o.slug === slug && !view.o.mode) mode = showTab(slug, cat) ? "feed" : "gallery";
      modes.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x.dataset.mode === mode); });
      curCat = cat; focusCard = null; setTimeout(pickFocus, 900);
      cats.classList.toggle("past", slug === FIC && PAST.indexOf(cat) > -1); subRow(slug, cat);
      if (liveSeen) { liveSeen.disconnect(); feed.querySelectorAll("video.live").forEach(function (v) { v.pause(); v.removeAttribute("src"); v.load(); }); }
      autoCard = null; var run = ++renderRun; setTimeout(function () { autoFirst(run); }, (delay || 0) + 450);
      requestAnimationFrame(function () { pickFocus(true); }); // tailles (perspective) dès l'affichage des films
      feed.className = "feed" + (mode === "gallery" ? " gallery" : "");
      feed.style.setProperty("--d", delay + "ms");
      clearProj();
      feed.textContent = ""; if (popSeen) popSeen.disconnect();
      var shown = tabFilms(slug, cat);
      var isShow = shown.length && showTab(slug, cat) && (mode === "feed" || phone.matches);
      var isPhotos = !isShow && cat !== "FEATURED" && shown.length && shown.every(function (p) { return !p.full && (p.nosnip || !p.video) && photosOf(p).length; });
      work.classList.toggle("photos-on", !!isPhotos); document.body.classList.toggle("photos-on", !!isPhotos); // pas de choix grille / colonne pour les photos
      precharger(shown.map(function (p) { return !p.nosnip && p.video; }));
      if (isShow) { renderShow(shown); return; }
      if (isPhotos) { renderPhotos(shown); return; }
      shown.forEach(function (p, i) {
        var d = document.createElement("div"); d.className = "card"; d.style.setProperty("--i", i);
        var st = document.createElement("div"); st.className = "still"; st.style.setProperty("--h", p.h);
        // Recadrage (admin, position du cadre = --zp) : l'extrait au survol ; la vignette aussi si « zoomThumb » est coché.
        if (slug === FIC) scopeCrop(st, p); // fiction : cadrage cinémascope (vignette et extrait réglés à part dans l'admin)
        else if (p.zoom > 1) { st.style.setProperty("--z", p.zoom); if (p.zoomPos) st.style.setProperty("--zp", p.zoomPos); if (p.zoomThumb) st.classList.add("zoomed"); }
        if (p.img) {
          loadImg(thumb(p.img, mode === "gallery" ? GW : FW), (function (st) { return function (url) { st.style.setProperty("--img", 'url("' + url + '")'); st.classList.add("ready"); }; })(st));
        }
        var meta = document.createElement("div"); meta.className = "meta";
        var h = document.createElement("h3"); h.textContent = dtitle(p);
        // Sans crédits : rien sous le titre (la catégorie est déjà l'onglet, ou affichée à part dans FEATURED : .ccat).
        var s = document.createElement("p"); s.textContent = p.sub || "";
        meta.appendChild(h); if (s.textContent) meta.appendChild(s);
        if (p.dps && p.dps.length && MULTI[slug]) meta.appendChild(dpLine(p, "cdop"));
        // Fiction : date de sortie (carré blanc au survol), seulement dans NEW RELEASES et COMING SOON.
        // Fiction : genre puis plateformes (« FEATURE FILM · NETFLIX ») en haut à gauche, affichés au survol / à la sélection.
        var ftag = slug === FIC ? [p.genre].concat(p.platforms || []).filter(Boolean) : [];
        if (ftag.length) { var tg = document.createElement("span"); tg.className = "ctag"; tg.textContent = ftag.join(" · "); d.appendChild(tg); }
        if (slug === FIC && (cat === "FEATURED" || cat === "COMING SOON") && ficDate(p.date)) { var dt = document.createElement("span"); dt.className = "cdate"; dt.textContent = ficDate(p.date); d.appendChild(dt); } // sur la carte, pas la vignette (agrandie au survol)
        // Films « Narrative » : types de contenu Slate (Short Film, Series…, lus par le robot de l'admin → p.types) à la suite de la
        // catégorie dans FEATURED, seuls dans l'onglet Narrative (Narrative jamais écrit deux fois).
        var clab = p.cat && cat === "FEATURED" && slug !== FIC ? [p.cat].concat(narrTypes(p)) : cat === p.cat ? narrTypes(p) : [];
        if (clab.length) { var cc = document.createElement("span"); cc.className = "ccat"; cc.textContent = clab.join(" · "); (mode === "gallery" ? meta : st).appendChild(cc); }
        d.appendChild(st); d.appendChild(meta); feed.appendChild(d);
        liveThumb(st, p);
        d._p = p;
        d.addEventListener("mouseenter", function (e) { if (!inZone(e)) return; dropAuto(d); showProj(p); snip(st, p, true); });
        d.addEventListener("mouseleave", function () { snip(st, p, false); if (selCard) showProj(selCard._p, 0); else document.body.classList.remove("proj-on"); });
        d.addEventListener("click", function (e) { if (!inZone(e)) return; if (newTab(e)) { filmTab(p); return; } openPlayer(p); });
        d.addEventListener("auxclick", function (e) { if (e.button === 1 && inZone(e)) filmTab(p); });
      });
      // Ombre noire des vignettes (galerie) : calque fixe, sans video, derriere la grille ; calcule une fois par affichage.
      if (mode === "gallery") {
        var shade = document.createElement("div"); shade.className = "shade";
        for (var n = feed.children.length; n > 0; n--) shade.appendChild(document.createElement("i"));
        feed.insertBefore(shade, feed.firstChild);
      }
      // Arrivée en grandissant (grille, spotlight, fiction ; pas le feed d'un chef op) : chaque film quand il entre à l'écran.
      if (popSeen && (mode === "gallery" || slug === SPOT || slug === FIC)) {
        popT0 = Date.now(); popD = delay || 0;
        var sh = mode === "gallery" ? feed.querySelectorAll(".shade i") : [];
        feed.querySelectorAll(".card").forEach(function (c, i) { c.classList.add("pop"); c._i = i; c._sh = sh[i]; if (sh[i]) sh[i].classList.add("pop"); popSeen.observe(c); });
      }
    }
    // Catégorie de photos (ex. « PHOTOGRAPHY ») : tous ses projets sont en images seulement (page Slate « illustration »,
    // images ajoutées par le robot de l'admin) → les photos en colonnes, chacune avec son ratio d'origine (jamais
    // recadrées), qui montent en fondu ; clic = photo en grand (flèches : toutes les photos de la catégorie).
    function photosOf(p) { return p.images && p.images.length ? p.images : p.stills || []; }
    // Présentation « vidéo + stills » d'un onglet (interrupteur de l'admin → `showcase` de la fiche, Gus 29/10) : par projet, la
    // vidéo en grand (extrait au survol), titre et crédits à côté, 6 stills autour ; projet sans vidéo : sa 1re image en grand et
    // les 6 suivantes. Projets alternés gauche / droite, séparés par un trait fin ; type de contenu Slate au-dessus.
    // Clic sur la vidéo = lecteur (et toute la galerie dessous) ; clic sur une image = l'image en grand dans le lecteur, avec toute
    // la galerie dessous (sans la vidéo).
    function galleryOf(p) {
      var all = photosOf(p).slice();
      (p.extras || []).forEach(function (x) { (x.stills || []).forEach(function (u) { if (all.indexOf(u) < 0) all.push(u); }); });
      return all;
    }
    function hasFilm(p) { return !!(p.full || (p.video && !p.nosnip)); }
    function openShowStill(p, i) {
      var all = galleryOf(p);
      // Sous la galerie : le film du projet, puis les autres vidéos ajoutées sous le film dans l'admin (dans leur ordre).
      var vids = (hasFilm(p) ? [{ full: p.full, video: p.nosnip ? "" : p.video, img: p.img }] : [])
        .concat((p.extras || []).filter(function (x) { return !x.stills && (x.full || x.video); }));
      var q = Object.assign({}, p, { full: "", video: "", nosnip: true, img: all[i], stills: all, images: null, extras: vids, poster: null, _big: i });
      openPlayer(q, false, [q]);
    }
    // Téléphone et ordinateur : l'extrait de la grande vidéo démarre 1,5 s après son arrivée à l'écran, en long fondu (on voit
    // d'abord la vignette, souvent la plus belle image ; Gus 30/10). Il s'arrête (vignette de retour) quand la vidéo quitte l'écran.
    var slowSeen = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var st = e.target, v = st.querySelector("video.slow"); if (!v) return;
        clearTimeout(st._slowT); st._seen = e.isIntersecting;
        if (e.isIntersecting) { if (!st._hov) slowLater(st, v); }
        else { v.pause(); v.classList.remove("on"); }
      });
    }, { root: work, threshold: 0.6 }) : null;
    function slowPlay(v) { if (!v.src) v.src = v.dataset.src; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
    function slowLater(st, v) { clearTimeout(st._slowT); st._slowT = setTimeout(function () { slowPlay(v); }, 1500); }
    // Ordinateur : la souris passe avant. Survol = l'extrait tout de suite (ou il continue s'il jouait déjà) ; la souris part =
    // vignette de retour, puis l'extrait reprend seul 1,5 s après (Gus 30/10).
    function slowHover(st, on) {
      var v = st.querySelector("video.slow"); if (!v || phone.matches) return;
      st._hov = on; clearTimeout(st._slowT);
      if (on) slowPlay(v);
      else { v.pause(); v.classList.remove("on"); if (st._seen) slowLater(st, v); }
    }
    function slowThumb(st, p) {
      if (!slowSeen || !p.video || reduceMotion) return;
      var v = document.createElement("video");
      v.className = "snip live slow"; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "none"; v.dataset.src = p.video;
      v.addEventListener("playing", function () { v.classList.add("on"); });
      st.appendChild(v); slowSeen.observe(st);
    }
    // Téléphone : le projet au repère (45 % de la hauteur) est « sélectionné » : sa vignette en fond flouté.
    var focusSc = null;
    function scFocus() {
      var r = work.getBoundingClientRect(), line = r.top + r.height * 0.45, best = null, bd = 1e9;
      feed.querySelectorAll(".sc").forEach(function (w) {
        var b = w.getBoundingClientRect(), d = line < b.top ? b.top - line : line > b.bottom ? line - b.bottom : 0;
        if (d < bd) { bd = d; best = w; }
      });
      if (best === focusSc) return;
      if (focusSc) focusSc.classList.remove("focus");
      focusSc = best;
      if (best) { best.classList.add("focus"); if (best._bg) showProj({ img: best._bg }); }
    }
    function renderShow(list) {
      focusSc = null; if (slowSeen) slowSeen.disconnect(); if (popSeen) popSeen.disconnect();
      feed.className = "feed showcase";
      var films = list.filter(hasFilm);
      list.forEach(function (p, i) {
        var all = galleryOf(p), film = hasFilm(p), small = (film ? all : all.slice(1)).slice(0, 6);
        if (i) { var hr = document.createElement("div"); hr.className = "sc-hr"; feed.appendChild(hr); }
        var w = document.createElement("div"); w.className = "sc" + (small.length ? "" : " bare");
        w._bg = p.img || all[0]; // fond flouté quand le projet est sélectionné (téléphone) ; vidéo à gauche partout (Gus 30/10)
        var ty = document.createElement("p"); ty.className = "sc-type"; ty.textContent = typesOf(p).join(" · "); w.appendChild(ty);
        var g = document.createElement("div"); g.className = "sc-grid"; w.appendChild(g);
        var big;
        if (film || !all.length) {
          big = document.createElement("div"); big.className = "still sc-big"; big.style.setProperty("--h", p.h);
          if (p.zoom > 1) { big.style.setProperty("--z", p.zoom); if (p.zoomPos) big.style.setProperty("--zp", p.zoomPos); if (p.zoomThumb) big.classList.add("zoomed"); }
          if (p.img) loadImg(thumb(p.img, FW), function (u) { big.style.setProperty("--img", 'url("' + u + '")'); });
          big.addEventListener("mouseenter", function () { showProj(p); slowHover(big, true); });
          big.addEventListener("mouseleave", function () { slowHover(big, false); document.body.classList.remove("proj-on"); });
          big.addEventListener("click", function () { openPlayer(p, false, films.length ? films : [p]); });
          slowThumb(big, p);
          if (film) big.insertAdjacentHTML("beforeend", '<svg class="sc-play" viewBox="0 0 24 28" aria-hidden="true"><path d="M2 2 L22 14 L2 26 Z"/></svg>');
        } else {
          big = document.createElement("button"); big.className = "sc-big sc-img"; big.setAttribute("aria-label", p.title);
          loadImg(thumb(all[0], FW), function (u) { big.style.backgroundImage = 'url("' + u + '")'; });
          big.addEventListener("click", function () { openShowStill(p, 0); });
          big.addEventListener("mouseenter", function () { showProj({ img: all[0] }); });
          big.addEventListener("mouseleave", function () { document.body.classList.remove("proj-on"); });
        }
        g.appendChild(big);
        var info = document.createElement("div"); info.className = "sc-info";
        var h = document.createElement("h3"); h.textContent = dtitle(p); info.appendChild(h);
        if (p.sub) { var sb = document.createElement("p"); sb.textContent = p.sub; info.appendChild(sb); }
        var spec = specOf(p); if (spec.length) { var sp = document.createElement("p"); sp.className = "sc-spec"; sp.textContent = spec.join("  |  "); info.appendChild(sp); }
        g.appendChild(info);
        small.forEach(function (u, k) {
          var b = document.createElement("button"); b.className = "sc-s s" + k; b.setAttribute("aria-label", p.title + " — image " + (k + 1));
          loadImg(thumb(u, GW), function (v) { b.style.backgroundImage = 'url("' + v + '")'; });
          b.addEventListener("click", function () { openShowStill(p, all.indexOf(u)); });
          b.addEventListener("mouseenter", function () { showProj({ img: u }); }); // fond flou : l'image survolée
          b.addEventListener("mouseleave", function () { document.body.classList.remove("proj-on"); });
          g.appendChild(b);
        });
        feed.appendChild(w);
        // Arrivée des images et de la vidéo, comme sur l'ancien site Squarespace : un peu plus petites, elles grandissent
        // jusqu'à leur taille en apparaissant, au moment où elles entrent à l'écran (Gus 30/10).
        if (popSeen) g.querySelectorAll(".sc-big, .sc-s").forEach(function (m, k) { m.classList.add("pop"); m.style.setProperty("--pd", (k ? 120 + k * 70 : 0) + "ms"); popSeen.observe(m); });
      });
    }
    // Films à l'écran dès l'affichage : en cascade après l'animation du nom (delay de render) ; ensuite, au défilement, par rangée.
    var popT0 = 0, popD = 0;
    var popSeen = "IntersectionObserver" in window && !reduceMotion ? new IntersectionObserver(function (es) {
      var first = Date.now() - popT0 < 300;
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var t = e.target;
        if (t._i != null) t.style.setProperty("--pd", (first ? popD + t._i * 70 : (t._i % (mode === "gallery" ? 3 : 1)) * 70) + "ms");
        t.classList.add("in"); if (t._sh) { t._sh.style.setProperty("--pd", t.style.getPropertyValue("--pd")); t._sh.classList.add("in"); }
        popSeen.unobserve(t);
      });
    }, { root: work, threshold: 0.12 }) : null;
    function renderPhotos(list) {
      feed.className = "feed photos";
      // Colonnes remplies en JS, dans l'ordre (chaque photo dans la colonne la moins haute), chaque case ayant déjà la
      // forme de sa photo (proportions notées par le robot, `ratios`) : rien ne bouge quand les photos arrivent.
      var all = [], k = 0, run = renderRun, n = phone.matches ? 2 : 3, probes = [];
      var groups = list.map(function (p) {
        var urls = photosOf(p), g = { p: p, urls: urls, ratios: p.ratios && p.ratios.length === urls.length ? p.ratios : null };
        // Proportions pas encore connues (robot pas encore passé) : on lit la taille de chaque photo avant de les placer.
        if (!g.ratios) g.probe = urls.map(function (u) { var im = new Image(); im.src = u; probes.push(im); return im; });
        return g;
      });
      var t0 = Date.now();
      (function wait() {
        if (run !== renderRun) return;
        if (probes.some(function (im) { return !im.naturalWidth && !im.complete; }) && Date.now() - t0 < 4000) { setTimeout(wait, 60); return; }
        layout();
      })();
      function layout() {
        var order = [];
        groups.forEach(function (g) {
          var p = g.p;
          if (groups.length > 1) { // plusieurs séries : leur titre au-dessus de chacune
            var h = document.createElement("div"); h.className = "phead";
            var t = document.createElement("h3"); t.textContent = dtitle(p); h.appendChild(t);
            if (p.sub) { var sb = document.createElement("p"); sb.textContent = p.sub; h.appendChild(sb); }
            feed.appendChild(h);
          }
          var box = document.createElement("div"); box.className = "pcols"; feed.appendChild(box);
          var cols = [], hs = [];
          for (var c = 0; c < n; c++) { cols.push(box.appendChild(document.createElement("div"))); cols[c].className = "pcol"; hs.push(0); }
          g.urls.forEach(function (u, j) {
            var im = g.probe ? g.probe[j] : new Image();
            var r = g.ratios ? g.ratios[j] : im.naturalWidth ? im.naturalWidth / im.naturalHeight : 0;
            if (!r) r = 1.5;
            var i = all.push(u) - 1, b = document.createElement("button");
            b.className = "ph"; b.style.aspectRatio = r; b.style.setProperty("--i", k++ % 6); b.setAttribute("aria-label", "Photo " + (i + 1));
            im.alt = p.title;
            var show = function () { b.classList.add("shown"); };
            order.push({ src: u, im: im, show: show }); // affichées dans l'ordre (orderedLoad), même déjà mesurées
            b.appendChild(im);
            var best = 0; for (var c2 = 1; c2 < n; c2++) if (hs[c2] < hs[best] - 1e-6) best = c2;
            cols[best].appendChild(b); hs[best] += 1 / r;
            b.addEventListener("click", function () { openPhoto(all, i, p.title); });
          });
        });
        orderedLoad(order, function (it) { if (it.im.src !== it.src) it.im.src = it.src; it.show(); }, function () { return run === renderRun; });
      }
    }
    // Photo en grand, sans passer par le lecteur : la fermer revient directement à la page.
    function openPhoto(all, i, title) {
      pgal.textContent = ""; pstage.textContent = "";
      stillsP = { title: title, stills: all };
      player.classList.add("on", "photo-only");
      showStill(i);
    }
    // Sur téléphone, si les onglets dépassent, ils défilent lentement vers la gauche, en boucle (une 2e copie suit
    // la 1re) ; un doigt sur les onglets met le défilement en pause quelques secondes.
    var tabsLoop = 0;
    function marquee() {
      var run = ++tabsLoop;
      // Retire la copie d'un passage précédent (écran tourné, fenêtre élargie, page réaffichée) : jamais deux copies,
      // ni de copie restée visible en mise en page ordinateur.
      cats.querySelectorAll('button[aria-hidden="true"]').forEach(function (x) { x.remove(); });
      cats.ontouchstart = cats.onscroll = null;
      cats.scrollLeft = 0;
      if (!phone.matches || reduceMotion || cats.scrollWidth <= cats.clientWidth + 2) return;
      var first = cats.firstElementChild, n = cats.children.length;
      tabSet(true);
      var on = cats.querySelector("button.on"), half = cats.children[n].offsetLeft - first.offsetLeft, last = performance.now(), hold = last + 2500; // pause au début : onglet ouvert bien visible
      var pos = on ? Math.max(0, on.offsetLeft - first.offsetLeft) : 0; cats.scrollLeft = pos;
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
      tabSet = function (copy) { (CATS_BY[slug] || CATS).forEach(function (c) { tabButton(c, copy); }); if (!MULTI[slug]) aboutButton(copy); };
      function tabButton(c, copy) {
        var b = document.createElement("button");
        b.textContent = catLabel(slug, c); b.dataset.cat = c; if (c === curCat) b.className = "on";
        if (slug === FIC && FIC_GENRES.indexOf(c) > -1) b.classList.add("sub"); // genres : visibles seulement dans PAST RELEASES
        if (slug === FIC && c.slice(-1) === "S" && FIC_GENRES.indexOf(c.slice(0, -1)) > -1) b.classList.add("only"); // FIC_ALL : seulement ouvert
        if (copy) b.setAttribute("aria-hidden", "true");
        else { b.style.setProperty("--i", cats.children.length); if (b.classList.contains("sub")) b.style.setProperty("--j", FIC_GENRES.indexOf(c)); } // rang dans l'arrivée en cascade (CSS)
        b.addEventListener("click", function () {
          cats.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x.dataset.cat === c); });
          work.classList.remove("about-mode"); document.body.classList.remove("about-on");
          work.scrollTop = 0; render(slug, c, 0); tabUrl(slug, c);
        });
        cats.appendChild(b);
      }
      function aboutButton(copy) {
      var ab = document.createElement("button");
      ab.textContent = "ABOUT"; ab.className = "sep"; ab.dataset.cat = "ABOUT";
      if (copy) ab.setAttribute("aria-hidden", "true"); else ab.style.setProperty("--i", cats.children.length);
      ab.addEventListener("click", function () {
        tabUrl(slug, "ABOUT");
        cats.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x.dataset.cat === "ABOUT"); });
        about.textContent = "";
        var d = ABOUT[slug] || {};
        // Bio : anglais d'abord. Une seule langue renseignée : elle seule, sans choix FR/EN ; les deux : choix EN/FR
        // (le dernier choix du visiteur est gardé).
        var hasEn = !!(d.bioEn && d.bioEn.length), hasFr = !!(d.bio && d.bio.length);
        var lang = hasEn ? "en" : "fr";
        if (hasEn && hasFr) { try { if (localStorage.getItem("kinou-lang") === "fr") lang = "fr"; } catch (e) {} }
        var bio = document.createElement("div");
        function fill() {
          bio.textContent = "";
          ((lang === "en" ? d.bioEn : d.bio) || []).forEach(function (t) { var p = document.createElement("p"); p.textContent = t; bio.appendChild(p); });
        }
        if (hasEn && hasFr) {
          var tg = document.createElement("div"); tg.className = "lang";
          ["en", "fr"].forEach(function (l) {
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
        // Seulement les liens renseignés dans l'admin (pas de CV, d'Instagram ou de site : pas de lien).
        [["CV", "cv"], ["INSTAGRAM", "instagram"], ["WEBSITE", "website"]].forEach(function (l) {
          var u = String(d[l[1]] || "").trim(); if (!u) return;
          var a = document.createElement("a"); a.textContent = l[0] + " \u2197"; a.href = u; a.target = "_blank"; a.rel = "noopener";
          links.appendChild(a);
        });
        // Autres liens ajoutés dans l'admin (IMDb, Vimeo…) : about.links = [{ label, url }], dans l'ordre.
        (d.links || []).forEach(function (l) {
          var u = String(l.url || "").trim(), t = String(l.label || "").trim(); if (!u || !t) return;
          if (!/^[a-z]+:/i.test(u)) u = "https://" + u;
          var a = document.createElement("a"); a.textContent = t.toUpperCase() + " \u2197"; a.href = u; a.target = "_blank"; a.rel = "noopener";
          links.appendChild(a);
        });
        if (links.children.length) about.appendChild(links);
        work.classList.add("about-mode"); work.scrollTop = 0; clearProj();
        if (d.img) {
          aboutbg.style.backgroundImage = (d.shade || 'linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.3) 45%, rgba(0,0,0,.6))') + ', url("' + d.img + '")';
          aboutbg.style.backgroundPosition = d.pos || "center 30%";
          // Zoom réglé dans l'admin (about.zoom) : agrandissement vers le point de cadrage.
          aboutbg.style.transformOrigin = d.pos || "center 30%";
          aboutbg.style.transform = d.zoom > 1 ? "scale(" + d.zoom + ")" : "";
          aboutbg.style.filter = d.color ? "none" : ""; // noir et blanc sauf si décoché dans l'admin (about.color)
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
          if (view && !phone.matches) { view.o.mode = m; tabUrl(slug, curCat); } // l'adresse garde l'affichage choisi
          modes.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
          work.scrollTop = 0; render(slug, curCat, 0);
        });
        modes.appendChild(b);
      });
    }
    // Arrivée en cascade des onglets (animation CSS subIn) : elle commence quand les onglets apparaissent (--td, même délai que
    // .cats), puis --td est remis à 0 pour que les genres de PAST RELEASES ouverts ensuite arrivent tout de suite.
    var tabsT = 0;
    function tabsIn() {
      var d = view ? Math.max(0, view.t0 + ANIM - Date.now()) : 0;
      document.body.style.setProperty("--td", d + "ms");
      clearTimeout(tabsT); tabsT = setTimeout(function () { document.body.style.setProperty("--td", "0ms"); }, d + 1500);
    }
    function showWork(slug, film) {
      if (!WORK[slug]) {
        document.body.classList.remove("has-work");
        // Fiche pas encore chargee : on la charge, puis on affiche si la page est toujours ouverte.
        loadDP(slug).then(function (d) { if (d && view && view.o.slug === slug) openWork(slug, film); });
        return;
      }
      // Onglets : juste après la fin de l'arrivée du nom (animation de ANIM ms), même si les films sont déjà prêts.
      if (view) cats.style.transitionDelay = Math.max(0, view.t0 + ANIM - Date.now()) + "ms";
      tabsIn();
      document.body.classList.add("has-work");
      setTimeout(function () { warmAll(slug); }, 1200); // apres FEATURED : les autres categories
      work.classList.remove("about-mode", "contact-mode"); document.body.classList.remove("about-on"); work.scrollTop = 0; mode = wantMode(); buildTabs(slug);
      // Onglet demandé dans l'adresse (#slug/fashion) : ouvert directement, sinon FEATURED.
      var want = view && view.o.cat, c0 = want && (CATS_BY[slug] || CATS).filter(function (c) { return catSlug(c) === want; })[0];
      if (want === "about") { var abt = cats.querySelector('button[data-cat="ABOUT"]'); if (abt) { render(slug, "FEATURED", 0); abt.click(); return; } }
      if (c0 && c0 !== "FEATURED") {
        curCat = c0; cats.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x.dataset.cat === c0); });
        render(slug, c0, 700); return;
      }
      render(slug, "FEATURED", 700);
      if (film) {
        var cards = feed.querySelectorAll(".card");
        var pick = film.slate && [].some.call(cards, function (c) { return c._p.slate === film.slate; });
        for (var i = 0; i < cards.length; i++) if (pick ? cards[i]._p.slate === film.slate : cards[i]._p.open) {
          var hv = HomeAPI.videoEl();
          selCard = cards[i]; selCard.classList.add("sel"); showProj(selCard._p, hv && !hv._hd ? hv.currentTime : 0);
          break;
        }
      }
    }
    // Template des pages DP : un seul ("default") pour tous les DPs. Une fiche peut demander
    // "template": "special" ; tant qu'aucun template special n'existe, default s'applique.
    var TEMPLATES = { "default": showWork };
    function openWork(slug, film) { if (slug === CONTACT) return showContact(); (TEMPLATES[TEMPLATE[slug]] || TEMPLATES["default"])(slug, film); }
    // ---------- Contact (data/contact.json, page « contact » de l'admin) ----------
    // Présenté comme un générique de fin : rôle à gauche, nom à droite, de part et d'autre d'un axe ; rôle écrit sur
    // chaque ligne (même s'il est identique à celui du dessus : Gus 27/10). Fond : le film de l'accueil en cours (ou un au hasard), flouté.
    var contactData = null, cbox = null;
    function cel(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
    function showContact() {
      document.body.classList.remove("has-work"); cats.textContent = "";
      (contactData ? Promise.resolve(contactData) : getJSON("contact.json")).then(function (c) {
        if (!view || view.o.slug !== CONTACT) return;
        contactData = c || {}; renderContact(contactData);
      }, function () { if (view && view.o.slug === CONTACT) renderContact({}); });
    }
    function renderContact(c) {
      clearProj(); work.classList.remove("about-mode"); document.body.classList.remove("about-on");
      renderRun++; if (liveSeen) liveSeen.disconnect(); feed.querySelectorAll("video").forEach(function (v) { v.pause(); }); feed.textContent = ""; // films de la page d'avant
      work.classList.add("contact-mode"); work.scrollTop = 0;
      if (!cbox) { cbox = cel("div", "contact"); work.appendChild(cbox); }
      cbox.textContent = "";
      var crew = cel("div", "crew"), k = 0;
      (c.team || []).forEach(function (t) {
        if (!t || !(t.name || t.email)) return;
        var row = cel("div", "crow"), role = String(t.role || "").trim();
        row.style.setProperty("--i", k++);
        row.appendChild(cel("span", "crole", role));
        var who = cel("div", "cwho");
        who.appendChild(cel("span", "cname", t.name));
        if (t.email) { var m = cel("a", "", t.email); m.href = "mailto:" + t.email; who.appendChild(m); }
        if (t.phone) { var ph = cel("a", "", t.phone); ph.href = "tel:" + t.phone.replace(/[^+\d]/g, ""); who.appendChild(ph); }
        row.appendChild(who); crew.appendChild(row);
      });
      cbox.appendChild(crew);
      var end = cel("div", "cend"); end.style.setProperty("--i", k + 1);
      var addr = (c.address || []).filter(Boolean);
      if (addr.length) {
        var ad = cel("a", "caddr"); ad.target = "_blank"; ad.rel = "noopener";
        ad.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr.join(", "));
        addr.forEach(function (l, i) { if (i) ad.appendChild(document.createElement("br")); ad.appendChild(document.createTextNode(l)); });
        end.appendChild(ad);
      }
      if (c.newsletter) { var nl = cel("a", "cnews", c.newsletterLabel || "Subscribe to the newsletter"); nl.href = c.newsletter; nl.target = "_blank"; nl.rel = "noopener"; end.appendChild(nl); }
      var so = c.social || {}, links = cel("nav", "csocial");
      [["instagram", "Instagram"], ["vimeo", "Vimeo"], ["imdb", "IMDb"], ["facebook", "Facebook"]].forEach(function (x) {
        if (!so[x[0]]) return; var a = cel("a", "", x[1]); a.href = so[x[0]]; a.target = "_blank"; a.rel = "noopener"; links.appendChild(a);
      });
      if (links.children.length) end.appendChild(links);
      if (c.legal && String(c.legal).trim()) {
        var lb = cel("button", "clegalbtn", "Mentions légales"), lt = cel("div", "clegal");
        // Une ligne seule, courte, sans « : » ni point final ni chiffre (« Éditeur », « Cookies »…) = titre de rubrique.
        String(c.legal).trim().split(/\n\s*\n/).forEach(function (para) {
          para = para.trim(); var title = para.length <= 40 && !/[\n:.\d@]/.test(para);
          lt.appendChild(cel(title ? "h4" : "p", "", para));
        });
        lb.addEventListener("click", function () { var on = !lt.classList.contains("on"); lt.classList.toggle("on", on); if (on) setTimeout(function () { lt.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 50); });
        end.appendChild(lb); end.appendChild(lt);
      }
      cbox.appendChild(end);
      // Fond : très flouté (comme le fond d'une page de chef op). Depuis l'accueil : le film en cours, là où il en était
      // (passage HD compris) ; sinon un film de l'accueil au hasard.
      var hv = document.body.classList.contains("is-home") && HomeAPI.videoEl(), hp = hv && HomeAPI.current();
      if (hp) showProj({ video: hv.currentSrc || hp.video, img: hp.img, seg: HomeAPI.segment() }, hv.currentTime || 0.01);
      else {
        var bgs = (HOME || []).filter(function (h) { return h.video || h.img; });
        if (bgs.length) { var b = bgs[Math.floor(Math.random() * bgs.length)]; showProj({ video: b.video, img: b.img }, 0); }
      }
      cats.style.transitionDelay = view ? Math.max(0, view.t0 + ANIM - Date.now()) + "ms" : "";
      document.body.classList.add("has-work");
    }
    document.querySelectorAll("li a[data-view]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (newTab(e)) return;
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
      if (t === "list") roul.kick();
    }

    // ---------- Roulette des chefs op (téléphone, en portrait) ----------
    // Inspirée de la roulette Squarespace : noms en boucle, le nom au repère (38 % de la hauteur) est grand et blanc,
    // les autres rapetissent et s'estompent. Défilement au doigt avec élan ; au lâcher, la course est calculée pour
    // s'arrêter pile sur un nom (pas d'arrêt entre deux noms puis de recalage brusque). Le nom au centre affiche
    // en fond l'extrait de son 1er film FEATURED ; toucher un autre nom l'amène au centre, toucher le nom au centre
    // ouvre sa page.
    var roul = (function () {
      var box = document.getElementById("roulette"), mq = window.matchMedia("(max-width: 700px) and (hover: none) and (orientation: portrait)");
      var N = DPS.length, H = 58, POOL = 30, REF = 0.38, TAU = 300; // TAU : durée de l'élan (ms), plus grand = défile plus longtemps
      var SIZE = [11, 20, 26], OP = [0.2, 0.65, 1], SPREAD = 4.5, MID = 0.7, PLATEAU = 0.3;
      var offset = 0, pool = [], raf = 0, glide = null, touch = null, selTimer = 0, sel = -1, boxH = 0;
      function mod(i) { return ((i % N) + N) % N; }
      function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
      function look(d) { // d : distance au repère, en nombre de noms
        if (d >= SPREAD) return [SIZE[0], OP[0]];
        if (d >= MID) { var t = smooth(1 - (d - MID) / (SPREAD - MID)); return [SIZE[0] + (SIZE[1] - SIZE[0]) * t, OP[0] + (OP[1] - OP[0]) * t]; }
        if (d >= PLATEAU) { var u = smooth(smooth(1 - (d - PLATEAU) / (MID - PLATEAU))); return [SIZE[1] + (SIZE[2] - SIZE[1]) * u, OP[1] + (OP[2] - OP[1]) * u]; }
        return [SIZE[2], OP[2]];
      }
      for (var i = 0; i < POOL; i++) {
        var el = document.createElement("div"); el.className = "ritem";
        el.appendChild(document.createTextNode(""));
        var t = document.createElement("span"); t.className = "t"; el.appendChild(t);
        box.appendChild(el); pool.push(el);
      }
      function render() {
        raf = 0;
        if (!boxH) boxH = box.clientHeight || window.innerHeight; // lu une fois (pas à chaque image)
        var h = boxH, ref = h * REF, c = offset / H, first = Math.floor(c) - Math.floor(POOL / 2);
        pool.forEach(function (el, k) {
          var slot = first + k, y = ref + (slot - c) * H;
          if (y < -80 || y > h + 80) { if (!el._off) { el.style.visibility = "hidden"; el._off = true; } return; }
          var d = DPS[mod(slot)], parts = split(d.name), st = look(Math.abs(y - ref) / H);
          if (el._off) { el.style.visibility = ""; el._off = false; }
          if (el._slug !== d.slug) { el.firstChild.nodeValue = parts.main; el.lastChild.textContent = parts.tags; el._slug = d.slug; el._name = d.name; }
          el._slot = slot;
          // Taille par mise à l'échelle (pas de changement de police à chaque image : bien plus fluide).
          el.style.transform = "translate3d(0," + (y - H / 2) + "px,0) scale(" + (st[0] / SIZE[2]).toFixed(3) + ")";
          el.style.opacity = st[1].toFixed(3);
        });
        var s = mod(Math.round(c));
        if (s !== sel) { sel = s; clearTimeout(selTimer); selTimer = setTimeout(pick, 260); }
      }
      function draw() { if (!raf) raf = requestAnimationFrame(render); }
      // Nom resté au centre un instant (pas pendant un défilement rapide) : fond vidéo de son 1er film.
      function pick() {
        if (!active() || !document.body.classList.contains("is-list") || document.body.classList.contains("viewing")) return;
        var d = DPS[sel], a = document.querySelector('li a[data-view="' + d.slug + '"]');
        if (roulSel === d.slug) return;
        hide(); roulSel = d.slug; loadDP(d.slug);
        if (a) showBgVideo(a);
      }
      // Glisse jusqu'à « target » : décélération exponentielle (élan naturel), arrivée exacte.
      function glideTo(target, tau) {
        var from = offset, t0 = performance.now();
        cancelAnimationFrame(glide);
        (function step(now) {
          var k = 1 - Math.exp(-(now - t0) / tau);
          offset = from + (target - from) * k;
          if (Math.abs(target - offset) < 0.4) { offset = target; render(); glide = null; return; }
          render(); glide = requestAnimationFrame(step);
        })(t0);
      }
      box.addEventListener("touchstart", function (e) {
        cancelAnimationFrame(glide); glide = null;
        var y = e.touches[0].clientY;
        touch = { y: y, y0: y, t: performance.now(), v: 0, moved: false, dir: 0 };
      }, { passive: true });
      box.addEventListener("touchmove", function (e) {
        e.preventDefault();
        if (!touch) return;
        var y = e.touches[0].clientY, now = performance.now(), dy = touch.y - y, dt = Math.max(1, now - touch.t);
        touch.v = 0.7 * (dy / dt) + 0.3 * touch.v; // vitesse lissée (px/ms)
        if (Math.abs(dy) > 0.5) touch.dir = dy > 0 ? 1 : -1;
        if (Math.abs(y - touch.y0) > 6) touch.moved = true;
        touch.y = y; touch.t = now; offset += dy; draw();
      }, { passive: false });
      box.addEventListener("touchend", function (e) {
        if (!touch) return;
        var tc = touch; touch = null;
        if (!tc.moved) { // simple toucher
          var el = e.target.closest(".ritem");
          if (!el) return;
          e.preventDefault();
          if (el._slot === Math.round(offset / H)) open(el); else glideTo(el._slot * H, 160);
          return;
        }
        var v = performance.now() - tc.t > 80 ? 0 : tc.v; // doigt immobile avant de lâcher : pas d'élan
        var end = offset + v * TAU, target = Math.round(end / H) * H;
        if (Math.abs(v) < 0.05) { // lâché lentement : on finit vers le nom suivant dans le sens du geste
          var c = offset / H;
          target = (tc.dir > 0 ? Math.ceil(c - 0.15) : tc.dir < 0 ? Math.floor(c + 0.15) : Math.round(c)) * H;
          glideTo(target, 140);
        } else glideTo(target, TAU);
      }, { passive: false });
      function open(el) {
        var d = DPS[mod(el._slot)];
        openView({ text: d.name, slug: d.slug, from: "list", a: el, rect: nameRect(el, split(d.name).main) });
      }
      function active() { return mq.matches; }
      function sync() { document.body.classList.toggle("roulette-on", mq.matches); if (mq.matches) draw(); }
      mq.addEventListener ? mq.addEventListener("change", sync) : mq.addListener(sync);
      window.addEventListener("resize", function () { boxH = 0; draw(); });
      sync();
      return {
        active: active,
        // Centre la roulette sur un chef op (retour depuis sa page) et renvoie l'élément de son nom.
        center: function (slug) {
          var i = DPS.findIndex(function (d) { return d.slug === slug; }); if (i < 0) return null;
          var c = Math.round(offset / H), slot = c + ((i - mod(c) + N + Math.floor(N / 2)) % N) - Math.floor(N / 2);
          cancelAnimationFrame(glide); offset = slot * H; render();
          return pool.filter(function (el) { return el._slot === slot; })[0] || null;
        },
        // Arrivée sur la liste : un nom au hasard au centre (comme l'accueil), pas toujours le premier.
        kick: function () { if (active()) { cancelAnimationFrame(glide); offset = Math.floor(Math.random() * N) * H; roulSel = null; sel = -1; render(); } }
      };
    })();
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
    // Liens de l'en-tete pas encore actifs (fiction, press).
    document.querySelectorAll("[data-soon]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); }); });
    window.Site = { prefetch: warmThumbs, playHome: playHome, fromHome: function (p, a) { openView({ text: a.dataset.name, slug: a.dataset.slug, from: "home", rect: homeNameRect(a), film: p }); } };
    document.querySelector(".logo").setAttribute("href", pageURL(""));
    document.querySelector(".nav-btn").setAttribute("href", pageURL(LIST));
    document.querySelector(".logo").addEventListener("click", function (e) {
      if (newTab(e)) return;
      e.preventDefault(); if (!view && document.body.classList.contains("is-home")) return;
      closeView(true); show("home"); pushPage({ k: "home" });
    });
    document.querySelector(".nav-btn").addEventListener("click", function (e) {
      if (newTab(e)) return;
      e.preventDefault();
      if (view && view.o.from === "home") {
        // arrive depuis l'accueil : la liste prend la place, et le nom y retourne en reduisant
        var la = document.querySelector('li a[data-view="' + view.o.slug + '"]');
        if (la) { view.o.from = "list"; view.o.a = la; show("list"); }
      }
      if (view && view.o.from === "list") { closeView(); pushPage({ k: "list" }); return; }
      if (!view && document.body.classList.contains("is-list")) return;
      closeView(true); show("list"); pushPage({ k: "list" });
    });
    // Liens directs : page-du-site#slug-du-chef-op ouvre directement sa page.
    function routeFromHash() {
      var h = parseHash(), slug = h.slug;
      if (slug === LIST && h.cat === "") { show("list"); undeep(); return; } // liste des chefs op
      if (PAGES[slug] && !view) { openPage(slug, null, { noHistory: true, cat: h.cat, mode: h.mode }); if (h.film) openFilmLater(slug, h.film); undeep(700); return; }
      var a = slug && document.querySelector('li a[data-view="' + slug + '"]');
      if (!a || view) { undeep(); return; }
      show("list");
      openView({ text: a.textContent, slug: slug, from: "list", a: a, instant: true, noHistory: true, cat: h.cat, mode: h.mode });
      if (h.film) openFilmLater(slug, h.film);
      undeep(700); // la liste a fini de s'effacer derrière la page
    }
    var r0 = route(), f0 = r0 && parseHash().film;
    if (f0) r0 = r0.split("/").slice(0, 2).join("/"); // adresse d'un film : la page dessous garde l'adresse de son onglet
    if (r0) routeFromHash(); else undeep();
    // Adresse réécrite sous sa forme définitive (ancienne adresse en #… ou arrivée par une page d'aperçu) : c'est elle qu'on partage.
    var onList = !view && document.body.classList.contains("is-list");
    try { history.replaceState(view ? { k: "dp", slug: view.o.slug } : { k: onList ? "list" : "home" }, "", view ? pageURL(r0) : pageURL(onList ? LIST : "")); } catch (e) {}
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (plight.classList.contains("on")) closeStill(); else if (player.classList.contains("on")) closePlayer(); else if (view) { closeView(); pushPage({ k: document.body.classList.contains("is-home") ? "home" : "list" }); } } }); // Échap : l'adresse suit (accueil ou liste)
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

  Promise.all([getJSON("home.json"), getJSON("dps/index.json"), VC_P]).then(function (r) {
    // Video club : vignette, titre et film complet retouchés (l'accueil garde sa vidéo, pas d'extrait).
    r[0].slides.forEach(function (p) { var e = vcOf(p.slate); if (!e) return; if (e.img) p.img = e.img; if (typeof e.full === "string" && e.full) p.full = e.full; });
    // Ancien format : { dp, slug } ; nouveau (admin, bande Slate) : dps: [{ name, slug }].
    // Pages cachées dans l'admin (« En ligne sur le site » décoché, `hidden` dans index.json ; Gus 10/11) : ni dans la liste, ni
    // liées (leur nom reste écrit sur l'accueil et sous les films, sans lien) ; leur adresse ouvre quand même la page (Gus 24/11).
    var off = {}, dps = r[1].dps.filter(function (d) { if (d.hidden) off[d.slug] = true; return !d.hidden; });
    var hid = r[1].dps.filter(function (d) { return d.hidden && d.slug; });
    var slides = r[0].slides.map(function (p) { if (!p.dps) p.dps = [{ name: p.dp, slug: p.slug }]; p.dps.forEach(function (d) { if (off[d.slug]) delete d.slug; }); return p; });
    initHome(slides, r[0].duration);
    initSite(dps, slides, hid);
  }).catch(function (e) { undeep(); console.error("kinou : chargement des donnees impossible", e); });
})();
