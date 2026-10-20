// kinou — logique du site. Les donnees viennent des fichiers JSON de DATA_BASE.
(function () {
  // Donnees JSON : publiees par l'admin (repo kinou-agency/admin), lues ici par le site officiel et la beta.
  var DATA_BASE = "https://kinou-admin.netlify.app/data/";
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
      var inner = document.createElement("div"); inner.className = "in"; s.appendChild(inner);
      var fx = document.createElement("div"); fx.className = "fx"; inner.appendChild(fx);
      if (p.video) {
        var v = document.createElement("video");
        v.muted = true; v.playsInline = true; v.preload = "none"; v.dataset.src = p.video;
        inner.appendChild(v);
      }
      wrap.appendChild(s); slides.push(s);
      var b = document.createElement("button");
      b.setAttribute("aria-label", p.dp + " — " + p.film);
      b.addEventListener("click", function () { go(i); });
      bars.appendChild(b); buttons.push(b);
    });

    // Garde le nom sur une seule ligne : reduit la taille si l'espace manque.
    function fit() {
      var nm = name.querySelector(".n");
      if (!nm) return;
      name.style.fontSize = "";
      var mobile = window.innerWidth <= 700;
      var avail = mobile ? window.innerWidth - 48 : window.innerWidth - 64 - cap.offsetWidth - 32;
      var size = parseFloat(getComputedStyle(name).fontSize);
      while (nm.offsetWidth > avail && size > 14) { size -= 2; name.style.fontSize = size + "px"; }
    }
    window.addEventListener("resize", fit);

    function next() { go(cur + 1); }
    function later() { clearTimeout(timer); timer = setTimeout(next, DURATION); }

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
      cur = i;
      var p = PROJECTS[i];
      slides[i].classList.add("on"); buttons[i].classList.add("on");

      cap.classList.remove("show"); name.classList.remove("show");
      setTimeout(function () {
        film.textContent = p.film; film.className = p.song ? "big" : ""; document.getElementById("song").textContent = p.song || ""; legend.textContent = p.legend;
        var parts = p.dp.split(","), main = parts[0].trim(), tags = parts.slice(1).join(", ").trim();
        name.textContent = ""; name.href = p.href;
        var nm = document.createElement("span"); nm.className = "n"; nm.textContent = main; name.appendChild(nm);
        if (tags) { var tg = document.createElement("div"); tg.className = "tags"; tg.textContent = tags; name.appendChild(tg); }
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
    var x0 = null;
    document.addEventListener("touchstart", function (e) { if (!active) return; x0 = e.touches[0].clientX; }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
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
    name.addEventListener("click", function (e) { e.preventDefault(); if (active && window.Site) Site.fromHome(PROJECTS[cur]); });
    window.HomeAPI = {
      pause: function () { active = false; clearTimeout(timer); var v = slides[cur].querySelector("video"); if (v) v.pause(); },
      resume: function () { if (active) return; active = true; var v = slides[cur].querySelector("video"); if (v && v.src) { var pr = v.play(); if (pr && pr.catch) pr.catch(later); v.onended = next; } else later(); },
      videoEl: function () { return slides[cur].querySelector("video"); }
    };
    go(0);
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
      else if (im.complete) apply(placeholder(u));
      else {
        im.addEventListener("load", function () { apply(u); });
        im.addEventListener("error", function () { apply(placeholder(u)); });
      }
    }
    // Image provisoire : si la vraie image est introuvable, on genere un fond
    // cinema (degrade + bokeh) unique pour chaque technicien.
    function placeholder(key) {
      var h = 2166136261;
      for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
      function rnd() { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }
      var hue = Math.floor(rnd() * 360), hue2 = (hue + 40 + Math.floor(rnd() * 80)) % 360;
      var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + hue + ',55%,22%)"/><stop offset="1" stop-color="hsl(' + hue2 + ',60%,8%)"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="28"/></filter></defs><rect width="1600" height="900" fill="url(#g)"/><g filter="url(#b)">';
      for (var j = 0; j < 9; j++) {
        s += '<circle cx="' + Math.floor(rnd() * 1600) + '" cy="' + Math.floor(rnd() * 900) + '" r="' + (40 + Math.floor(rnd() * 140)) + '" fill="hsl(' + ((hue + Math.floor(rnd() * 70)) % 360) + ',80%,' + (45 + Math.floor(rnd() * 25)) + '%)" fill-opacity="' + (0.25 + rnd() * 0.4).toFixed(2) + '"/>';
      }
      s += '</g></svg>';
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
    }
    // Fond video : extrait (snippet Slate) du premier film FEATURED du chef op, s'il a une fiche.
    var bgvid = document.getElementById("bgvid");
    function showBgVideo(a) {
      var slug = a.dataset.view;
      loadDP(slug).then(function (d) {
        if (!d || !(a.matches(":hover") || a === document.activeElement)) return;
        var f = (WORK[slug] || []).filter(function (p) { return p.f && p.video; }).sort(function (x, y) { return (x.fo || 0) - (y.fo || 0); })[0];
        if (!f) return;
        if (bgvid.dataset.src !== f.video) { bgvid.src = f.video; bgvid.dataset.src = f.video; }
        try { bgvid.currentTime = 0; } catch (e) {}
        bgvid.onplaying = function () { if (a.matches(":hover") || a === document.activeElement) bgvid.classList.add("on"); };
        var pr = bgvid.play(); if (pr && pr.catch) pr.catch(function () {});
      });
    }
    function hide() { bg.style.opacity = 0; bgvid.classList.remove("on"); bgvid.onplaying = null; bgvid.pause(); }

    document.querySelectorAll("li a").forEach(function (a) {
      a.addEventListener("mouseenter", function () { showBg(a); showBgVideo(a); });
      a.addEventListener("focus", function () { showBg(a); showBgVideo(a); });
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
    function homeNameRect() { return document.querySelector("#home .name .n").getBoundingClientRect(); }
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
    function thumb(u, w) {
      return IMG_CDN && /^https:\/\/images\.slatecdn\.net\//.test(u) ? "/.netlify/images?url=" + encodeURIComponent(u) + "&w=" + w + "&q=75&fm=webp" : u;
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
    function bgFor(p) {
      var h = p.h, g = 'radial-gradient(circle at 30% 35%, hsl(' + h + ',70%,38%), transparent 55%), radial-gradient(circle at 75% 70%, hsl(' + (h + 50) + ',65%,30%), transparent 50%), linear-gradient(135deg, hsl(' + h + ',45%,14%), #050505)';
      if (p.img) return 'linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("' + thumb(p.img, 800) + '"), ' + g; // meme fichier que la vignette (deja en cache)
      return 'linear-gradient(rgba(0,0,0,.25), rgba(0,0,0,.25)), ' + g;
    }
    // Ignore les cartes masquees sous l'en-tete (zone du titre) quand on a defile.
    function inZone(e) { return e.clientY >= parseFloat(getComputedStyle(work).paddingTop) - 6; }
  // Lecteur par-dessus la galerie / le feed
    var player = document.getElementById("player"), pstage = document.getElementById("pstage"), pcap = document.getElementById("pcap");
    function openPlayer(p) {
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
      var h = document.createElement("h3"); h.textContent = p.title; pcap.appendChild(h);
      var s = document.createElement("p"); s.textContent = p.sub || p.cat; pcap.appendChild(s);
      buildStills(p);
      player.classList.add("on");
    }
    // Lightbox des stills (p.stills) : vignettes sous la legende ; la premiere ramene au clip.
    var stillsP = null, stillsIdx = 0;
    function buildStills(p) {
      stillsP = null;
      player.classList.toggle("has-stills", !!(p.stills && p.stills.length));
      if (!p.stills || !p.stills.length) return;
      var strip = document.createElement("div"); strip.className = "pstills";
      [p.img].concat(p.stills).forEach(function (u, i) {
        var b = document.createElement("button");
        b.style.backgroundImage = u ? 'url("' + u + '")' : bgFor(p);
        b.setAttribute("aria-label", i ? "Still " + i : p.title);
        if (!i) b.className = "on";
        b.addEventListener("click", function () { showStill(p, i); });
        strip.appendChild(b);
      });
      pcap.appendChild(strip);
      stillsP = p; stillsIdx = 0;
    }
    function showStill(p, i) {
      var n = p.stills.length + 1; i = (i + n) % n;
      if (i === 0) { openPlayer(p); return; }
      var v = pstage.querySelector("video"); if (v) v.pause();
      pstage.textContent = "";
      var im = document.createElement("img"); im.src = p.stills[i - 1]; im.alt = p.title; pstage.appendChild(im);
      stillsIdx = i;
      pcap.querySelectorAll(".pstills button").forEach(function (b, k) { b.classList.toggle("on", k === i); });
    }
    document.addEventListener("keydown", function (e) {
      if (!stillsP || !player.classList.contains("on")) return;
      if (e.key === "ArrowRight") showStill(stillsP, stillsIdx + 1);
      if (e.key === "ArrowLeft") showStill(stillsP, stillsIdx - 1);
    });
    function closePlayer() {
      if (!player.classList.contains("on")) return;
      player.classList.remove("on");
      pstage.textContent = "";
      if (document.body.classList.contains("proj-on") && projvid.classList.contains("on")) { var pr = projvid.play(); if (pr && pr.catch) pr.catch(function () {}); }
    }
    player.addEventListener("click", function (e) { if (e.target === player || e.target.closest(".pclose")) closePlayer(); });
    function showProj(p, t) {
      projbg.style.backgroundImage = bgFor(p);
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
    // Au survol d'un projet : la vignette joue un extrait video muet ; le fond plein ecran reste l'image fixe
    var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function snip(st, p, on) {
      var v = st.querySelector("video.snip");
      if (!on) { if (v) { v.pause(); v.classList.remove("on"); } return; }
      var vsrc = p.video || p.full; // extrait d'apercu, sinon le film complet
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
    function render(slug, cat, delay) {
      curCat = cat;
      feed.className = "feed" + (mode === "gallery" ? " gallery" : "");
      feed.style.setProperty("--d", delay + "ms");
      clearProj();
      feed.textContent = "";
      WORK[slug].filter(function (p) { return cat === "FEATURED" ? p.f : p.cat === cat; }).sort(function (a, b) { return cat === "FEATURED" ? (a.fo || 0) - (b.fo || 0) : 0; }).forEach(function (p, i) {
        var d = document.createElement("div"); d.className = "card"; d.style.setProperty("--i", i);
        var st = document.createElement("div"); st.className = "still"; st.style.setProperty("--h", p.h);
        if (p.img) st.style.setProperty("--img", 'url("' + thumb(p.img, mode === "gallery" ? 800 : 1600) + '")');
        var meta = document.createElement("div"); meta.className = "meta";
        var h = document.createElement("h3"); h.textContent = p.title;
        var s = document.createElement("p"); s.textContent = p.sub || p.cat;
        meta.appendChild(h); meta.appendChild(s);
        d.appendChild(st); d.appendChild(meta); feed.appendChild(d);
        d._p = p;
        d.addEventListener("mouseenter", function (e) { if (!inZone(e)) return; showProj(p); snip(st, p, true); });
        d.addEventListener("mouseleave", function () { snip(st, p, false); if (selCard) showProj(selCard._p, 0); else document.body.classList.remove("proj-on"); });
        d.addEventListener("click", function (e) { if (!inZone(e)) return; openPlayer(p); });
      });
    }
    function buildTabs(slug) {
      cats.textContent = ""; curCat = "FEATURED";
      (CATS_BY[slug] || CATS).forEach(function (c) {
        var b = document.createElement("button");
        b.textContent = c; b.dataset.cat = c; if (c === curCat) b.className = "on";
        b.addEventListener("click", function () {
          cats.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
          work.classList.remove("about-mode"); document.body.classList.remove("about-on");
          work.scrollTop = 0; render(slug, c, 0);
        });
        cats.appendChild(b);
      });
      var ab = document.createElement("button");
      ab.textContent = "ABOUT"; ab.className = "sep";
      ab.addEventListener("click", function () {
        cats.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === ab); });
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
          mode = m;
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
      work.classList.remove("about-mode"); document.body.classList.remove("about-on"); work.scrollTop = 0; mode = "gallery"; buildTabs(slug); render(slug, "FEATURED", 700);
      if (film) {
        var cards = feed.querySelectorAll(".card");
        for (var i = 0; i < cards.length; i++) if (cards[i]._p.open) {
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
    document.getElementById("name").addEventListener("mouseenter", function () { loadDP(this.getAttribute("href").slice(1)); }); // precharge la fiche
    // Liens de l'en-tete pas encore actifs (spotlight, fiction).
    document.querySelectorAll("[data-soon]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); }); });
    window.Site = { fromHome: function (p) { openView({ text: p.dp, slug: p.slug, from: "home", rect: homeNameRect(), film: p }); } };
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
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (player.classList.contains("on")) closePlayer(); else closeView(); } });
  }

  Promise.all([getJSON("home.json"), getJSON("dps/index.json")]).then(function (r) {
    initHome(r[0].slides.map(function (p) { p.href = "#" + p.slug; return p; }), r[0].duration);
    initSite(r[1].dps);
  }).catch(function (e) { console.error("kinou : chargement des donnees impossible", e); });
})();
