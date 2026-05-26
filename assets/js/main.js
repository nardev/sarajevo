/* Sarajevo in Songs — interactivity
   ------------------------------------------------------------
   - Expand/collapse song rows
   - Tag filtering
   - Free-text search
   - Sort (popularity / year / title)
   ------------------------------------------------------------ */

(function () {
  const list   = document.querySelector('[data-song-list]');
  if (!list) return;
  const rows   = Array.from(list.querySelectorAll('.song'));
  const search = document.querySelector('[data-search]');
  const tags   = document.querySelectorAll('[data-tag]');
  const sort   = document.querySelector('[data-sort]');
  const count  = document.querySelector('[data-count]');
  const pager  = document.querySelector('[data-pagination]');

  const PAGE_SIZE = 20;
  let currentPage = 1;
  let showAll     = false;
  let filteredRows = [];

  /* ---- expand/collapse --------------------------------------------- */
  function closeRow(row) {
    row.classList.remove('is-open');
    const embed = row.querySelector('.video_embed');
    if (embed) embed.innerHTML = '';
    // Reset lyrics to initial state
    row.querySelectorAll('.lyrics-variant').forEach(v => {
      v.hidden = (v.dataset.lvar !== 'original');
      const excerpt = v.querySelector('.lyrics-excerpt');
      const full    = v.querySelector('.lyrics-full');
      const toggle  = v.querySelector('.lyrics-toggle');
      if (excerpt) excerpt.hidden = false;
      if (full)    full.hidden    = true;
      if (toggle)  {
        toggle.dataset.expanded = 'false';
        const txt = toggle.querySelector('.lyrics-toggle-text');
        if (txt) txt.textContent = 'Prikaži cijeli tekst';
      }
    });
    row.querySelectorAll('.lyrics-lang-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.lbtn === 'original');
    });
  }

  function ytIdFrom(slot) {
    return (slot.dataset.ytSrc || '').split('/embed/')[1] || '';
  }

  function showThumbnail(slot) {
    const ytId = ytIdFrom(slot);
    if (!ytId) return;
    const thumb = 'https://img.youtube.com/vi/' + ytId + '/hqdefault.jpg';
    slot.innerHTML =
      '<div class="video_thumb-play">' +
      '<img src="' + thumb + '" alt="">' +
      '<div class="video_play" aria-hidden="true"></div>' +
      '</div>';
    slot.querySelector('.video_thumb-play').addEventListener('click', () => injectIframe(slot));
  }

  function injectIframe(slot) {
    slot.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src   = slot.dataset.ytSrc + '?enablejsapi=1&autoplay=1';
    iframe.title = slot.dataset.ytTitle || '';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    slot.appendChild(iframe);
  }

  function showEmbedFallback(slot) {
    const ytId    = ytIdFrom(slot);
    if (!ytId) return;
    const ytWatch = 'https://www.youtube.com/watch?v=' + ytId;
    const thumb   = 'https://img.youtube.com/vi/' + ytId + '/hqdefault.jpg';
    slot.innerHTML =
      '<a class="video_thumb-link" href="' + ytWatch + '" target="_blank" rel="noopener" aria-label="Watch on YouTube">' +
      '<img src="' + thumb + '" alt="">' +
      '<div class="video_play" aria-hidden="true"></div>' +
      '</a>';
  }

  rows.forEach((row) => {
    const trigger = row.querySelector('.song_row');
    trigger.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;

      const willOpen = !row.classList.contains('is-open');

      rows.forEach((other) => { if (other.classList.contains('is-open')) closeRow(other); });

      if (willOpen) {
        row.classList.add('is-open');
        const slot = row.querySelector('.video_embed[data-yt-src]');
        if (slot) showThumbnail(slot);
      }
    });
  });

  /* ---- lyrics: language switch + expand/collapse ------------------- */
  document.addEventListener('click', (e) => {
    const langBtn = e.target.closest('.lyrics-lang-btn');
    if (langBtn) {
      const section = langBtn.closest('.lyrics-section');
      const lang    = langBtn.dataset.lbtn;
      section.querySelectorAll('.lyrics-lang-btn').forEach(b => b.classList.remove('is-active'));
      langBtn.classList.add('is-active');
      section.querySelectorAll('.lyrics-variant').forEach(v => {
        const show = v.dataset.lvar === lang;
        v.hidden = !show;
        if (show) {
          // reset this variant to collapsed
          const excerpt = v.querySelector('.lyrics-excerpt');
          const full    = v.querySelector('.lyrics-full');
          const toggle  = v.querySelector('.lyrics-toggle');
          if (excerpt) excerpt.hidden = false;
          if (full)    full.hidden    = true;
          if (toggle)  {
            toggle.dataset.expanded = 'false';
            const txt = toggle.querySelector('.lyrics-toggle-text');
            if (txt) txt.textContent = 'Prikaži cijeli tekst';
          }
        }
      });
      return;
    }

    const toggle = e.target.closest('.lyrics-toggle');
    if (toggle) {
      const variant  = toggle.closest('.lyrics-variant');
      const excerpt  = variant.querySelector('.lyrics-excerpt');
      const full     = variant.querySelector('.lyrics-full');
      const expanded = toggle.dataset.expanded === 'true';
      excerpt.hidden           = !expanded;
      full.hidden              = expanded;
      toggle.dataset.expanded  = expanded ? 'false' : 'true';
      const txt = toggle.querySelector('.lyrics-toggle-text');
      if (txt) txt.textContent = expanded ? 'Prikaži cijeli tekst' : 'Prikaži manje';
    }
  });

  // Detect YouTube embed-disabled errors (code 101 / 150) via postMessage
  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://www.youtube.com') return;
    let data;
    try { data = JSON.parse(e.data); } catch (_) { return; }
    if (data.event === 'onError' && (data.info === 100 || data.info === 101 || data.info === 150)) {
      document.querySelectorAll('.video_embed iframe').forEach((iframe) => {
        if (iframe.contentWindow === e.source) {
          showEmbedFallback(iframe.closest('.video_embed'));
        }
      });
    }
  });

  /* ---- filtering + pagination -------------------------------------- */
  let activeTag = 'all';
  let query     = '';

  function pluralize(n) {
    const last = n % 10, lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 14) return 'pjesama';
    if (last === 1) return 'pjesma';
    if (last >= 2 && last <= 4) return 'pjesme';
    return 'pjesama';
  }

  function applyFilters() {
    currentPage  = 1;
    filteredRows = Array.from(list.querySelectorAll('.song')).filter((row) => {
      const rowTags = (row.dataset.tags || '').toLowerCase().split(',');
      const text    = (row.dataset.search || '').toLowerCase();
      const tagOk   = activeTag === 'all' || rowTags.includes(activeTag);
      const qOk     = !query || text.includes(query);
      return tagOk && qOk;
    });
    renderPage();
  }

  function renderPage() {
    const total = filteredRows.length;
    const start = showAll ? 0 : (currentPage - 1) * PAGE_SIZE;
    const end   = showAll ? total : Math.min(start + PAGE_SIZE, total);

    rows.forEach((r) => { r.style.display = 'none'; });
    for (let i = start; i < end; i++) filteredRows[i].style.display = '';

    if (count) count.textContent = total + ' ' + pluralize(total) + ' pronađeno';
    renumber();
    renderPagination(total);
  }

  function renumber() {
    let n = 1;
    Array.from(list.querySelectorAll('.song')).forEach((row) => {
      if (row.style.display === 'none') return;
      const idx = row.querySelector('.song_index');
      if (idx) idx.textContent = n++;
    });
  }

  function renderPagination(total) {
    if (!pager) return;
    pager.innerHTML = '';
    if (total <= PAGE_SIZE) return;

    const totalPages = Math.ceil(total / PAGE_SIZE);

    if (!showAll) {
      for (let p = 1; p <= totalPages; p++) {
        const btn = document.createElement('button');
        btn.className   = 'pill' + (p === currentPage ? ' is-active' : '');
        btn.textContent = p;
        btn.addEventListener('click', () => {
          currentPage = p;
          renderPage();
          list.closest('.results').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        pager.appendChild(btn);
      }
    }

    const allBtn = document.createElement('button');
    allBtn.className   = 'pill' + (showAll ? ' is-active' : '');
    allBtn.textContent = showAll ? 'Paginacija' : 'Prikaži sve';
    allBtn.addEventListener('click', () => {
      showAll     = !showAll;
      currentPage = 1;
      renderPage();
    });
    pager.appendChild(allBtn);
  }

  tags.forEach((t) => {
    t.addEventListener('click', () => {
      tags.forEach((x) => x.classList.remove('is-active'));
      t.classList.add('is-active');
      activeTag = (t.dataset.tag || 'all').toLowerCase();
      applyFilters();
    });
  });

  if (search) {
    search.addEventListener('input', (e) => {
      query = e.target.value.trim().toLowerCase();
      applyFilters();
    });
  }

  /* ---- sorting ----------------------------------------------------- */
  if (sort) {
    sort.addEventListener('change', () => {
      const mode = sort.value;
      const sorted = rows.slice().sort((a, b) => {
        if (mode === 'artist') return (a.dataset.artist || '').localeCompare(b.dataset.artist || '');
        if (mode === 'year')   return (+a.dataset.year || 0) - (+b.dataset.year || 0);
        return (a.dataset.title || '').localeCompare(b.dataset.title || '');
      });
      sorted.forEach((r) => list.appendChild(r));
      applyFilters();
    });
  }

  applyFilters();
})();
