/**
 * Código ejecutado solo en el navegador vía page.evaluate(STRING).
 * Archivo .js plano: no pasa por TypeScript/tsx → no se inyecta __name().
 */
(function () {
  "use strict";
  var results = [];
  var seen = new Set();
  var CGE_HOST = "cge.entrerios.gov.ar";
  /** Solo convocatorias con /AAAA/MM/ = año y mes actuales (reloj del navegador). */
  var _nowCollect = new Date();
  var CURRENT_Y = _nowCollect.getFullYear();
  var CURRENT_M = _nowCollect.getMonth() + 1;
  var CURRENT_M_PADDED = CURRENT_M < 10 ? "0" + CURRENT_M : String(CURRENT_M);
  var EXPECTED_YM_PART = CURRENT_Y + "/" + CURRENT_M_PADDED;

  function pathMatchesCurrentYearMonth(pth) {
    if (!pth) return false;
    var pl = String(pth).toLowerCase();
    var m = pl.match(/\/(\d{4})\/(\d{2})\//);
    if (!m) return false;
    return parseInt(m[1], 10) === CURRENT_Y && parseInt(m[2], 10) === CURRENT_M;
  }

  var contestPathRegex =
    /(concurso|convocatoria|llamado|llamado-a|oposicion|oposición|cargo|adjudic|inscrip|horas-catedra|horas-cátedra|\beet\b)/i;

  /**
   * Acepta paths /AAAA/MM/slug con palabras clave o slugs largos típicos de notas de concursos
   * (Facebook a veces no muestra innerText pero el link está en el HTML).
   */
  function looksLikeContestPath(pth) {
    if (!pth) return false;
    var pl = String(pth).toLowerCase();
    if (/\/noticias\//.test(pl) || pl.includes("feriadecarrerasyoficios")) return false;
    if (!/\/\d{4}\/\d{2}\//.test(pl)) return false;
    if (contestPathRegex.test(pl)) return true;
    var m = pl.match(/\/\d{4}\/\d{2}\/([^/?#]+)/);
    var slug = m ? m[1] : "";
    if (slug.length < 20) return false;
    return /escuela|eet|conscri|ibicuy|ceibas|paranacito|giorgi|dde|villa-|islas|lengua|historia|matematic|educaci|t[eé]cnica|categor|docente|horas|nivel|convocat|concurs|oposic|secundaria|primaria|novedad|resoluc/i.test(
      pl,
    );
  }

  /** Valida path de concurso y devuelve URL normalizada o undefined. */
  function tryNormalizeCgeContestUrl(raw) {
    if (!raw || typeof raw !== "string") return undefined;
    var cleaned = raw.replace(/\\u0025/g, "%").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
    if (cleaned.indexOf("http") !== 0) {
      if (cleaned.indexOf("//cge.") === 0) cleaned = "https:" + cleaned;
      else if (cleaned.indexOf("cge.entrerios.gov.ar") === 0) cleaned = "https://" + cleaned;
    }
    try {
      var pu = new URL(cleaned);
      if (!pu.hostname.toLowerCase().includes(CGE_HOST)) return undefined;
      var pth = pu.pathname.toLowerCase();
      var med =
        pth.includes("/wp-content/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(pth);
      if (med || !/\/\d{4}\/\d{2}\//.test(pth) || !looksLikeContestPath(pth)) return undefined;
      if (!pathMatchesCurrentYearMonth(pth)) return undefined;
      pu.search = "";
      pu.hash = "";
      return pu.toString().replace(/\/$/, "");
    } catch (e) {
      return undefined;
    }
  }

  /**
   * Saca la URL real de envoltorios tipo l.facebook.com/l.php?u=https%3A%2F%2Fcge... (puede repetirse u).
   * Decodifica el parámetro u tantas veces como haga falta (doble encoding).
   */
  function unwrapFacebookOutboundHref(rawHref) {
    if (!rawHref) return rawHref;
    var out = String(rawHref).trim();
    var iter;
    for (iter = 0; iter < 6; iter++) {
      try {
        var url = new URL(out);
        var h = url.hostname.toLowerCase();
        var isFbHost =
          h.includes("facebook.com") || h.includes("fb.com") || h.includes("fbcdn.net");
        if (!isFbHost) break;
        var uParam =
          url.searchParams.get("u") ||
          url.searchParams.get("url") ||
          url.searchParams.get("href") ||
          url.searchParams.get("target_url");
        if (!uParam) break;
        var next = String(uParam).replace(/\+/g, " ");
        var decPass;
        var prevN;
        for (decPass = 0; decPass < 5 && /%[0-9A-Fa-f]{2}/.test(next); decPass++) {
          try {
            prevN = next;
            next = decodeURIComponent(next);
            if (next === prevN) break;
          } catch (eDec) {
            break;
          }
        }
        if (next === out) break;
        out = next;
      } catch (e) {
        return rawHref;
      }
    }
    return out;
  }

  var postNodes = Array.from(
    document.querySelectorAll(
      "article, div[role='article'], div.html-div, div[data-ad-preview='message'], div[data-ad-rendering-role='story_message']",
    ),
  );
  var pi;
  var pj;
  var post;
  var a;
  var href;
  var unwrapped;
  var u;
  var path;
  var isMedia;
  var cgeCandidate;
  var decoded;
  var match;
  var parsed;
  var fullText;
  var postRoot;
  var fromPost;
  var anchorText;

  /**
   * Facebook pone el enlace CGE real en <a href="https://cge.entrerios.gov.ar/..."> (p. ej. preview bajo
   * data-ad-rendering-role="image") sin pasar por l.php; a veces queda fuera del "post" que recorremos.
   * También href="https://l.facebook.com/l.php?u=https%3A%2F%2Fcge.entrerios.gov.ar%2F..." (a veces sin role=link).
   */
  var anchorSetEarly = new Set();
  var earlyLists = [
    document.querySelectorAll('a[href*="cge.entrerios.gov.ar"]'),
    document.querySelectorAll('a[href*="cge%2Eentrerios"]'),
    document.querySelectorAll('a[href*="l.facebook.com/l.php"]'),
    document.querySelectorAll('a[href*="lm.facebook.com/l.php"]'),
    document.querySelectorAll('a[href*="/l.php?"][href*="entrerios.gov"]'),
  ];
  for (var eli = 0; eli < earlyLists.length; eli++) {
    var nl = earlyLists[eli];
    for (var elj = 0; elj < nl.length; elj++) anchorSetEarly.add(nl[elj]);
  }
  var allCgeAnchors = Array.from(anchorSetEarly);
  for (pi = 0; pi < allCgeAnchors.length; pi++) {
    a = allCgeAnchors[pi];
    href = a.href || a.getAttribute("href") || "";
    if (!href) continue;
    unwrapped = unwrapFacebookOutboundHref(href);
    cgeCandidate = tryNormalizeCgeContestUrl(unwrapped);
    if (!cgeCandidate || seen.has(cgeCandidate)) continue;
    seen.add(cgeCandidate);
    postRoot = a.closest(
      "article, [role='article'], div.html-div, div[data-ad-preview='message'], div[data-ad-rendering-role='story_message'], div[data-ad-rendering-role='image']",
    );
    fromPost = postRoot ? (postRoot.innerText || "").trim() : "";
    anchorText = (a.getAttribute("aria-label") || a.innerText || "").trim();
    fullText =
      fromPost.length >= 40
        ? fromPost
        : anchorText.length >= 15
          ? anchorText
          : document.title || "Facebook post (anchor CGE)";
    results.push({
      postUrl: cgeCandidate,
      text: fullText,
      cgeUrl: cgeCandidate,
    });
  }

  for (pi = 0; pi < postNodes.length; pi++) {
    post = postNodes[pi];
    fullText = (post.innerText || "").trim();

    var anchors = Array.from(post.querySelectorAll("a[href]"));

    for (pj = 0; pj < anchors.length; pj++) {
      a = anchors[pj];
      href = a.href || "";
      if (!href) continue;

      unwrapped = unwrapFacebookOutboundHref(href);

      cgeCandidate = undefined;
      try {
        u = new URL(unwrapped);
        if (u.hostname.toLowerCase().includes(CGE_HOST)) {
          path = u.pathname.toLowerCase();
          isMedia = path.includes("/wp-content/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
          if (
            isMedia ||
            !/\/\d{4}\/\d{2}\//.test(path) ||
            !looksLikeContestPath(path) ||
            !pathMatchesCurrentYearMonth(path)
          ) {
            cgeCandidate = undefined;
          } else {
            u.search = "";
            u.hash = "";
            cgeCandidate = u.toString().replace(/\/$/, "");
          }
        }
      } catch (e1) {
        try {
          decoded = decodeURIComponent(unwrapped);
          match = decoded.match(/https?:\/\/[^\s"'<>]*cge\.entrerios\.gov\.ar[^\s"'<>]*/i);
          if (match) {
            parsed = new URL(match[0]);
            path = parsed.pathname.toLowerCase();
            isMedia = path.includes("/wp-content/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
            if (
              !isMedia &&
              /\/\d{4}\/\d{2}\//.test(path) &&
              looksLikeContestPath(path) &&
              pathMatchesCurrentYearMonth(path)
            ) {
              parsed.search = "";
              parsed.hash = "";
              cgeCandidate = parsed.toString().replace(/\/$/, "");
            }
          }
        } catch (e2) {
          /* ignore */
        }
      }

      if (!cgeCandidate || seen.has(cgeCandidate)) continue;
      seen.add(cgeCandidate);

      results.push({
        postUrl: cgeCandidate,
        text: fullText || document.title || "Facebook post",
        cgeUrl: cgeCandidate,
      });
    }

    // URLs en HTML del post (a veces hay varias convocatorias; innerText solo muestra una).
    var postHtml = post.innerHTML || "";
    if (postHtml.indexOf("cge") !== -1) {
      var localRe = /https?:\/\/[^\s"'<>]*cge\.entrerios\.gov\.ar[^\s"'<>]*/gi;
      var lm;
      while ((lm = localRe.exec(postHtml)) !== null) {
        cgeCandidate = tryNormalizeCgeContestUrl(lm[0]);
        if (!cgeCandidate || seen.has(cgeCandidate)) continue;
        seen.add(cgeCandidate);
        results.push({
          postUrl: cgeCandidate,
          text: fullText || document.title || "Facebook post",
          cgeUrl: cgeCandidate,
        });
      }
    }
  }

  var possiblePosts = Array.from(
    document.querySelectorAll(
      "article, div[role='article'], div.html-div, div[data-ad-preview='message'], div[data-ad-rendering-role='story_message'], div",
    ),
  );
  var el;
  var urlText;
  var reAllUrls = /https?:\/\/\S*?cge\.entrerios\.gov\.ar\S*/gi;
  for (pi = 0; pi < possiblePosts.length; pi++) {
    el = possiblePosts[pi];
    fullText = (el.innerText || "").trim();
    var elHtmlWrap = el.innerHTML || "";
    // Posts solo con imagen/enlace: innerText vacío pero el href está en el HTML.
    if (!fullText && elHtmlWrap.indexOf("cge") === -1) continue;
    if (fullText.indexOf("cge.entrerios.gov.ar") === -1 && elHtmlWrap.indexOf("cge") === -1) {
      continue;
    }
    reAllUrls.lastIndex = 0;
    var mm;
    while ((mm = reAllUrls.exec(fullText)) !== null) {
      urlText = mm[0].replace(/[),.;]+$/, "");
      cgeCandidate = tryNormalizeCgeContestUrl(urlText);
      if (!cgeCandidate || seen.has(cgeCandidate)) continue;
      seen.add(cgeCandidate);
      results.push({ postUrl: cgeCandidate, text: fullText, cgeUrl: cgeCandidate });
    }
    var elHtml = elHtmlWrap;
    if (elHtml.indexOf("cge") !== -1) {
      var reH = /https?:\/\/[^\s"'<>]*cge\.entrerios\.gov\.ar[^\s"'<>]*/gi;
      var hm;
      while ((hm = reH.exec(elHtml)) !== null) {
        cgeCandidate = tryNormalizeCgeContestUrl(hm[0]);
        if (!cgeCandidate || seen.has(cgeCandidate)) continue;
        seen.add(cgeCandidate);
        results.push({ postUrl: cgeCandidate, text: fullText, cgeUrl: cgeCandidate });
      }
    }
  }

  var preferredSel = [
    "div[data-ad-rendering-role='image'] a[role='link'][href]",
    "a[role='link'][href*='cge.entrerios.gov.ar']",
    "a[role='link'][href*='/l.php']",
    "a[role='link'][href*='l.facebook.com']",
    "a[role='link'][href*='lm.facebook.com']",
    /** Enlaces outbound sin role="link" (común en móvil / feed). */
    "a[href*='l.facebook.com/l.php']",
    "a[href*='lm.facebook.com/l.php']",
  ].join(", ");
  var preferredContestAnchors = Array.from(document.querySelectorAll(preferredSel));
  var text;
  for (pi = 0; pi < preferredContestAnchors.length; pi++) {
    a = preferredContestAnchors[pi];
    href = a.href || "";
    if (!href) continue;
    unwrapped = unwrapFacebookOutboundHref(href);
    cgeCandidate = undefined;
    try {
      u = new URL(unwrapped);
      if (u.hostname.toLowerCase().includes(CGE_HOST)) {
        path = u.pathname.toLowerCase();
        isMedia = path.includes("/wp-content/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
        if (
          !isMedia &&
          /\/\d{4}\/\d{2}\//.test(path) &&
          looksLikeContestPath(path) &&
          pathMatchesCurrentYearMonth(path)
        ) {
          u.search = "";
          u.hash = "";
          cgeCandidate = u.toString().replace(/\/$/, "");
        }
      }
    } catch (e) {
      /* ignore */
    }
    if (!cgeCandidate || seen.has(cgeCandidate)) continue;
    seen.add(cgeCandidate);
    postRoot = a.closest(
      "article, [role='article'], div.html-div, div[data-ad-preview='message'], div[data-ad-rendering-role='story_message'], div[data-ad-rendering-role='image']",
    );
    fromPost = postRoot ? (postRoot.innerText || "").trim() : "";
    anchorText = (a.innerText || "").trim();
    text =
      fromPost.length >= 40
        ? fromPost
        : anchorText.length >= 15
          ? anchorText
          : document.title || "Facebook post (preferred anchor)";
    results.push({ postUrl: cgeCandidate, text: text, cgeUrl: cgeCandidate });
  }

  var globalAnchors = Array.from(document.querySelectorAll("a[href]"));
  for (pi = 0; pi < globalAnchors.length; pi++) {
    a = globalAnchors[pi];
    href = a.href || "";
    if (!href) continue;
    unwrapped = unwrapFacebookOutboundHref(href);
    cgeCandidate = undefined;
    try {
      u = new URL(unwrapped);
      if (u.hostname.toLowerCase().includes(CGE_HOST)) {
        path = u.pathname.toLowerCase();
        isMedia = path.includes("/wp-content/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
        if (
          !isMedia &&
          /\/\d{4}\/\d{2}\//.test(path) &&
          looksLikeContestPath(path) &&
          pathMatchesCurrentYearMonth(path)
        ) {
          u.search = "";
          u.hash = "";
          cgeCandidate = u.toString().replace(/\/$/, "");
        }
      }
    } catch (e1) {
      try {
        decoded = decodeURIComponent(unwrapped);
        match = decoded.match(/https?:\/\/[^\s"'<>]*cge\.entrerios\.gov\.ar[^\s"'<>]*/i);
        if (match) {
          parsed = new URL(match[0]);
          path = parsed.pathname.toLowerCase();
          isMedia = path.includes("/wp-content/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
          if (
            !isMedia &&
            /\/\d{4}\/\d{2}\//.test(path) &&
            looksLikeContestPath(path) &&
            pathMatchesCurrentYearMonth(path)
          ) {
            parsed.search = "";
            parsed.hash = "";
            cgeCandidate = parsed.toString().replace(/\/$/, "");
          }
        }
      } catch (e2) {
        /* ignore */
      }
    }
    if (!cgeCandidate || seen.has(cgeCandidate)) continue;
    seen.add(cgeCandidate);
    postRoot = a.closest(
      "article, [role='article'], div.html-div, div[data-ad-preview='message'], div[data-ad-rendering-role='story_message'], div[data-ad-rendering-role='image']",
    );
    fromPost = postRoot ? (postRoot.innerText || "").trim() : "";
    anchorText = (a.innerText || "").trim();
    text =
      fromPost.length >= 40
        ? fromPost
        : anchorText.length >= 15
          ? anchorText
          : document.title || "Facebook post";
    results.push({ postUrl: cgeCandidate, text: text, cgeUrl: cgeCandidate });
  }

  var htmlRaw =
    document.documentElement && document.documentElement.innerHTML ? document.documentElement.innerHTML : "";
  /**
   * Facebook serializa URLs en JSON con escapes \u0025 = "%" y luego "3A", "2F", etc.
   * Sin convertir % primero, no matchea https://… y slugRegexPreview queda vacío.
   */
  var htmlUnescaped = htmlRaw
    .replace(/\\u0025/gi, "%")
    .replace(/\\\//g, "/")
    .replace(/\\u002f/gi, "/")
    .replace(/\\u003a/gi, ":")
    .replace(/\\u002e/gi, ".")
    .replace(/\\u002d/gi, "-")
    .replace(/\\u003f/gi, "?")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u0026/gi, "&");
  var regexDirect = /https?:\/\/[^\s"'<>]*cge\.entrerios\.gov\.ar[^\s"'<>]*/gi;
  // Slugs /YYYY/MM/... (captura varias convocatorias aunque vengan escapadas en JSON)
  var regexSlug =
    /\bhttps?:\/\/cge\.entrerios\.gov\.ar\/\d{4}\/\d{2}\/[a-z0-9\-]+/gi;
  var regexProtoless = /\/\/cge\.entrerios\.gov\.ar\/\d{4}\/\d{2}\/[a-z0-9\-]+/gi;
  var directMatches = (htmlRaw.match(regexDirect) || []).concat(htmlUnescaped.match(regexDirect) || []);
  /** URLs totalmente porcentuales en JSON (https%3A%2F%2Fcge%2Eentrerios…) */
  var regexPctCgeFull =
    /https%3A%2F%2F(?:cge%2E|cge\.)entrerios%2E(?:gov%2Ear|gov\.ar)(?:%2F[a-zA-Z0-9%\-\._~]+)+/gi;
  var pctCgeFromRaw = htmlRaw.match(regexPctCgeFull) || [];
  var pctCgeFromUn = htmlUnescaped.match(regexPctCgeFull) || [];
  var pci;
  for (pci = 0; pci < pctCgeFromRaw.length; pci++) {
    try {
      directMatches.push(decodeURIComponent(pctCgeFromRaw[pci]));
    } catch (e) {
      /* ignore */
    }
  }
  for (pci = 0; pci < pctCgeFromUn.length; pci++) {
    try {
      directMatches.push(decodeURIComponent(pctCgeFromUn[pci]));
    } catch (e) {
      /* ignore */
    }
  }
  var slugFromRaw = htmlRaw.match(regexSlug) || [];
  var slugFromUn = htmlUnescaped.match(regexSlug) || [];
  var slugPl = htmlRaw.match(regexProtoless) || [];
  var si;
  for (si = 0; si < slugFromRaw.length; si++) directMatches.push(slugFromRaw[si]);
  for (si = 0; si < slugFromUn.length; si++) directMatches.push(slugFromUn[si]);
  for (si = 0; si < slugPl.length; si++) directMatches.push("https:" + slugPl[si]);
  var regexPctEncoded = /https%3A%2F%2F[^"'&\s<>%]+/gi;
  var pctMatches = htmlRaw.match(regexPctEncoded) || [];
  var enc;
  var once;
  for (pi = 0; pi < pctMatches.length; pi++) {
    enc = pctMatches[pi];
    try {
      once = decodeURIComponent(enc);
      if (/%[0-9A-Fa-f]{2}/.test(once)) {
        try {
          once = decodeURIComponent(once);
        } catch (e) {
          /* ignore */
        }
      }
      if (once.includes(CGE_HOST)) directMatches.push(once);
    } catch (e) {
      /* ignore */
    }
  }

  var directMatchesPreNormCount = directMatches.length;

  var rawUrl;
  var cleaned;
  var normalized;
  for (pi = 0; pi < directMatches.length; pi++) {
    rawUrl = directMatches[pi];
    normalized = tryNormalizeCgeContestUrl(rawUrl);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    results.push({
      postUrl: normalized,
      text: document.title || "Facebook post (html fallback)",
      cgeUrl: normalized,
    });
  }

  var regexFbRedirect =
    /https?:\/\/(?:l\.|lm\.|m\.|www\.|touch\.|mbasic\.)facebook\.com\/l\.php\?[^"'<>]*/gi;
  var redirectMatches = (htmlRaw.match(regexFbRedirect) || []).concat(
    htmlUnescaped.match(regexFbRedirect) || [],
  );
  /** Facebook embebe /l.php?u=... como ruta relativa en JSON/HTML; no aparece en a[href]. */
  var MAX_REL_LPHP = 250;
  function collectRelativeLphp(html, baseHref) {
    var out = [];
    if (!html || !baseHref) return out;
    var needle = "/l.php?";
    var idx = 0;
    var end;
    var frag;
    while ((idx = html.indexOf(needle, idx)) !== -1) {
      end = idx + needle.length;
      while (end < html.length) {
        var c = html.charAt(end);
        if (c === '"' || c === "'" || c === "<" || c === " " || c === "\n" || c === "\r" || c === "\\")
          break;
        end++;
      }
      frag = html.slice(idx, end);
      try {
        out.push(new URL(frag, baseHref).href);
      } catch (e) {
        /* ignore */
      }
      if (out.length >= MAX_REL_LPHP) break;
      idx = end;
    }
    return out;
  }
  var baseForLphp =
    typeof location !== "undefined" && location.href ? location.href : "https://www.facebook.com/";
  /** Solo htmlUnescaped: evita duplicar miles de matches (mismo contenido que raw). */
  var relativeLphpArr = collectRelativeLphp(htmlUnescaped, baseForLphp);
  redirectMatches = redirectMatches.concat(relativeLphpArr);
  redirectMatches = Array.from(new Set(redirectMatches));
  /** Los primeros miles de l.php suelen ser tracking; los de CGE van con "cge" o "entrerios" en el string (a veces URL-encoded). */
  function redirectLikelyCgeTarget(s) {
    if (!s) return false;
    var t = String(s).toLowerCase();
    return (
      t.indexOf("cge") !== -1 ||
      t.indexOf("entrerios") !== -1 ||
      t.indexOf("%2fcge") !== -1 ||
      t.indexOf("%3a%2f%2fcge") !== -1 ||
      t.indexOf("cge%2e") !== -1 ||
      t.indexOf("cge%252e") !== -1
    );
  }
  redirectMatches.sort(function (a, b) {
    var ca = redirectLikelyCgeTarget(a) ? 0 : 1;
    var cb = redirectLikelyCgeTarget(b) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return 0;
  });
  if (redirectMatches.length > 12000) redirectMatches = redirectMatches.slice(0, 12000);
  var redirectLikelyCgeCount = 0;
  for (var rlc = 0; rlc < redirectMatches.length; rlc++) {
    if (redirectLikelyCgeTarget(redirectMatches[rlc])) redirectLikelyCgeCount++;
  }
  var redirect;
  var fixed;
  var uparam;
  for (pi = 0; pi < redirectMatches.length; pi++) {
    redirect = redirectMatches[pi];
    try {
      fixed = redirect.replace(/&amp;/g, "&");
      uparam = new URL(fixed).searchParams.get("u");
      if (!uparam) continue;
      decoded = decodeURIComponent(uparam);
      if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
        try {
          decoded = decodeURIComponent(decoded);
        } catch (e) {
          /* ignore */
        }
      }
      parsed = new URL(decoded);
      path = parsed.pathname.toLowerCase();
      isMedia = path.includes("/wp-content/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
      if (
        !parsed.hostname.toLowerCase().includes(CGE_HOST) ||
        isMedia ||
        !/\/\d{4}\/\d{2}\//.test(path) ||
        !looksLikeContestPath(path) ||
        !pathMatchesCurrentYearMonth(path)
      ) {
        continue;
      }
      parsed.search = "";
      parsed.hash = "";
      normalized = parsed.toString().replace(/\/$/, "");
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      results.push({
        postUrl: normalized,
        text: document.title || "Facebook post (redirect fallback)",
        cgeUrl: normalized,
      });
    } catch (e) {
      /* ignore */
    }
  }

  var regexExternalCdn = /https?:\/\/external[^\s"'<>]+/gi;
  var externalMatches = htmlRaw.match(regexExternalCdn) || [];
  var raw;
  var embeddedUrl;
  var extParsed;
  for (pi = 0; pi < externalMatches.length; pi++) {
    raw = externalMatches[pi];
    try {
      fixed = raw.replace(/&amp;/g, "&");
      extParsed = new URL(fixed);
      embeddedUrl = extParsed.searchParams.get("url");
      if (!embeddedUrl) continue;
      decoded = decodeURIComponent(embeddedUrl);
      if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
        try {
          decoded = decodeURIComponent(decoded);
        } catch (e) {
          /* ignore */
        }
      }
      parsed = new URL(decoded);
      path = parsed.pathname.toLowerCase();
      isMedia = path.includes("/wp-content/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
      if (
        !parsed.hostname.toLowerCase().includes(CGE_HOST) ||
        isMedia ||
        !/\/\d{4}\/\d{2}\//.test(path) ||
        !looksLikeContestPath(path) ||
        !pathMatchesCurrentYearMonth(path)
      ) {
        continue;
      }
      parsed.search = "";
      parsed.hash = "";
      normalized = parsed.toString().replace(/\/$/, "");
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      results.push({
        postUrl: normalized,
        text: document.title || "Facebook post (external fallback)",
        cgeUrl: normalized,
      });
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Si el HTML trae -102 y -100 pero Facebook no inyecta -101 en el DOM (virtualización),
   * rellenamos los enteros entre min y max del mismo path (misma convocatoria, sufijo numérico).
   */
  var gapHay = htmlRaw + "\n" + htmlUnescaped;
  var gapUrlRe = /https?:\/\/cge\.entrerios\.gov\.ar\/[^\s"'<>]+/gi;
  var gapM;
  var pathGroups = Object.create(null);
  while ((gapM = gapUrlRe.exec(gapHay)) !== null) {
    var rawGap = gapM[0].replace(/[),.;]+$/, "");
    try {
      var puG = new URL(rawGap);
      if (!puG.hostname.toLowerCase().includes(CGE_HOST)) continue;
      var pthG = puG.pathname.toLowerCase();
      if (!/\/\d{4}\/\d{2}\//.test(pthG)) continue;
      var pnm = pthG.match(/^(.*)-(\d{1,4})$/);
      if (!pnm) continue;
      var basePath = pnm[1];
      var nnum = parseInt(pnm[2], 10);
      if (nnum < 0 || nnum > 9999) continue;
      if (!pathGroups[basePath]) pathGroups[basePath] = [];
      pathGroups[basePath].push(nnum);
    } catch (eG) {
      /* ignore */
    }
  }
  var gp;
  for (gp in pathGroups) {
    if (!pathMatchesCurrentYearMonth(gp)) continue;
    var numsG = pathGroups[gp];
    var uniqG = Object.create(null);
    var gix;
    for (gix = 0; gix < numsG.length; gix++) uniqG[numsG[gix]] = true;
    var numList = [];
    for (var kg in uniqG) numList.push(parseInt(kg, 10));
    if (numList.length < 2) continue;
    var mnG = Math.min.apply(null, numList);
    var mxG = Math.max.apply(null, numList);
    if (mxG - mnG > 80) continue;
    for (var fi = mnG; fi <= mxG; fi++) {
      var candGap = "https://cge.entrerios.gov.ar" + gp + "-" + fi;
      var normGap = tryNormalizeCgeContestUrl(candGap);
      if (!normGap || seen.has(normGap)) continue;
      seen.add(normGap);
      results.push({
        postUrl: normGap,
        text: document.title || "Facebook post (serie gap-fill)",
        cgeUrl: normGap,
      });
    }
  }

  /**
   * Serie Ceibas N°1: el feed suele repetir solo ceibas-102 en l.php; 100/101 no aparecen como URL completa.
   * Buscamos el patrón en HTML normalizado (\u002d, %2F, etc.) y si solo hay un número, rellenamos hacia abajo
   * (p. ej. 102 → 90..102) para no depender de ver dos slugs distintos en el mismo snapshot.
   */
  var gapHayNorm = gapHay
    .replace(/\\u002d/gi, "-")
    .replace(/\\u002f/gi, "/")
    .replace(/%2d/gi, "-")
    .replace(/%2f/gi, "/");
  var ceibasDiag = { enabled: false, numsFound: [], rangeMin: null, rangeMax: null, filled: 0 };
  var fullCeib = gapHayNorm.match(
    /(20\d{2}\/\d{2})\/convocatoria-concurso-escuela-secundaria-n1-david-della-chiesa-ceibas-(\d{2,4})/i,
  );
  if (!fullCeib) {
    fullCeib = htmlRaw.match(
      /(20\d{2}\/\d{2})\/convocatoria-concurso-escuela-secundaria-n1-david-della-chiesa-ceibas-(\d{2,4})/i,
    );
  }
  if (!fullCeib) {
    fullCeib = htmlUnescaped.match(
      /(20\d{2}\/\d{2})\/convocatoria-concurso-escuela-secundaria-n1-david-della-chiesa-ceibas-(\d{2,4})/i,
    );
  }
  if (fullCeib && fullCeib[1] === EXPECTED_YM_PART) {
    ceibasDiag.enabled = true;
    var ymCeibPart = fullCeib[1];
    var ceibTailRe = new RegExp(
      "/" +
        ymCeibPart.replace(/\//g, "\\/") +
        "/convocatoria-concurso-escuela-secundaria-n1-david-della-chiesa-ceibas-(\\d{2,4})",
      "gi",
    );
    var cnumsCeib = [];
    function collectCeib(str) {
      if (!str) return;
      ceibTailRe.lastIndex = 0;
      var mc;
      while ((mc = ceibTailRe.exec(str)) !== null) cnumsCeib.push(parseInt(mc[1], 10));
    }
    collectCeib(gapHayNorm);
    collectCeib(htmlRaw);
    collectCeib(htmlUnescaped);
    var uniqCeib = Object.create(null);
    var cci;
    for (cci = 0; cci < cnumsCeib.length; cci++) uniqCeib[cnumsCeib[cci]] = true;
    var cList = [];
    for (var uce in uniqCeib) cList.push(parseInt(uce, 10));
    ceibasDiag.numsFound = cList.slice();
    var cmnC;
    var cmxC;
    if (cList.length >= 2) {
      cmnC = Math.min.apply(null, cList);
      cmxC = Math.max.apply(null, cList);
    } else if (cList.length === 1) {
      cmnC = cList[0] - 12;
      cmxC = cList[0];
    } else {
      cmnC = parseInt(fullCeib[2], 10) - 12;
      cmxC = parseInt(fullCeib[2], 10);
      ceibasDiag.numsFound = [parseInt(fullCeib[2], 10)];
    }
    if (cmxC - cmnC > 35) cmxC = cmnC + 35;
    ceibasDiag.rangeMin = cmnC;
    ceibasDiag.rangeMax = cmxC;
    for (var cfib = cmnC; cfib <= cmxC; cfib++) {
      if (cfib < 1 || cfib > 9999) continue;
      var candCeib =
        "https://cge.entrerios.gov.ar/" +
        ymCeibPart +
        "/convocatoria-concurso-escuela-secundaria-n1-david-della-chiesa-ceibas-" +
        cfib;
      var normCeib = tryNormalizeCgeContestUrl(candCeib);
      if (!normCeib || seen.has(normCeib)) continue;
      seen.add(normCeib);
      ceibasDiag.filled++;
      results.push({
        postUrl: normCeib,
        text: document.title || "Facebook post (ceibas serie)",
        cgeUrl: normCeib,
      });
    }
  }

  // Orden tipo feed: primero lo que aparece más arriba en el HTML (p. ej. -102, luego -101, -100).
  var haystack = (htmlRaw + "\n" + htmlUnescaped).toLowerCase();
  function feedOrderKey(postUrl) {
    if (!postUrl) return 2000000000;
    var u = String(postUrl).toLowerCase();
    var pathOnly = u.replace(/^https?:\/\/[^/]+/i, "");
    var i = haystack.indexOf(pathOnly);
    if (i < 0) i = haystack.indexOf(u);
    if (i < 0) {
      var parts = u.split("/");
      var slug = parts[parts.length - 1] || u;
      i = haystack.indexOf(slug);
    }
    if (i < 0) return 2000000000;
    return i;
  }
  results.sort(function (a, b) {
    return feedOrderKey(a.postUrl) - feedOrderKey(b.postUrl);
  });

  var cgeIdxSnip = htmlRaw.toLowerCase().indexOf("cge.entrerios.gov.ar");
  var htmlSnippetAroundCge =
    cgeIdxSnip < 0
      ? ""
      : htmlRaw.slice(Math.max(0, cgeIdxSnip - 100), Math.min(htmlRaw.length, cgeIdxSnip + 420));
  htmlSnippetAroundCge = htmlSnippetAroundCge.replace(/\s+/g, " ").trim();
  if (htmlSnippetAroundCge.length > 520) htmlSnippetAroundCge = htmlSnippetAroundCge.slice(0, 520) + "…";

  var lphpIdxSnip = htmlRaw.indexOf("/l.php?");
  var htmlSnippetAroundLphp =
    lphpIdxSnip < 0
      ? ""
      : htmlRaw.slice(Math.max(0, lphpIdxSnip - 80), Math.min(htmlRaw.length, lphpIdxSnip + 380));
  htmlSnippetAroundLphp = htmlSnippetAroundLphp.replace(/\s+/g, " ").trim();
  if (htmlSnippetAroundLphp.length > 480) htmlSnippetAroundLphp = htmlSnippetAroundLphp.slice(0, 480) + "…";

  var gapSeriesSample = [];
  var gsk;
  for (gsk in pathGroups) {
    if (gapSeriesSample.length >= 6) break;
    var arrS = pathGroups[gsk];
    var uqS = Object.create(null);
    var gsi;
    for (gsi = 0; gsi < arrS.length; gsi++) uqS[arrS[gsi]] = true;
    var nlS = [];
    for (var ks in uqS) nlS.push(parseInt(ks, 10));
    nlS.sort(function (a, b) {
      return a - b;
    });
    gapSeriesSample.push({
      pathSuffix: gsk.length > 64 ? "…" + gsk.slice(-64) : gsk,
      numsInHtml: nlS,
    });
  }

  var slugPreview = (htmlRaw.match(regexSlug) || [])
    .concat(htmlUnescaped.match(regexSlug) || [])
    .slice(0, 12);

  var diag = {
    documentTitle: typeof document !== "undefined" && document.title ? document.title : "",
    locationHref: typeof location !== "undefined" && location.href ? location.href : "",
    cgeUrlOnlyYearMonth: EXPECTED_YM_PART,
    htmlRawLen: htmlRaw.length,
    htmlUnescapedLen: htmlUnescaped.length,
    postNodesCount: postNodes.length,
    anchorCountGlobal:
      typeof document !== "undefined" && document.querySelectorAll
        ? document.querySelectorAll("a[href]").length
        : 0,
    cgeHostOccurrencesInHtml: (htmlRaw.match(/cge\.entrerios\.gov\.ar/gi) || []).length,
    cgeEncodedFragmentsInHtml:
      (htmlRaw.match(/cge%2Eentrerios|entrerios%2Egov/gi) || []).length,
    pctCgeFullUrlMatches: pctCgeFromRaw.length + pctCgeFromUn.length,
    lphpSlashOccurrences: htmlRaw.split("/l.php?").length - 1,
    directUrlCandidates: directMatchesPreNormCount,
    relativeLphpCollected: relativeLphpArr.length,
    redirectsAfterDedup: redirectMatches.length,
    redirectsLikelyCge: redirectLikelyCgeCount,
    externalCdnUrlMatches: externalMatches.length,
    gapSeriesBases: Object.keys(pathGroups).length,
    gapSeriesSample: gapSeriesSample,
    ceibasNeighborhood: ceibasDiag,
    slugRegexPreview: slugPreview,
    urlsReturned: results.length,
    postUrlsPreview: results.slice(0, 18).map(function (r) {
      return r.postUrl;
    }),
    htmlSnippetAroundFirstCge: htmlSnippetAroundCge,
    htmlSnippetAroundFirstLphp: htmlSnippetAroundLphp,
  };

  return { posts: results, diag: diag };
})();
