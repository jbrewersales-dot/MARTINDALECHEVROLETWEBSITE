(function () {
  const $ = id => document.getElementById(id);
  const S = { down: VDP.fin.down, term: VDP.fin.term, trade: 0 };
  function pay() { const p = Math.max(0, VDP.price - S.down - S.trade); const r = VDP.fin.apr / 100 / 12; if (!p) return 0; return Math.round(r ? p * r / (1 - Math.pow(1 + r, -S.term)) : p / S.term); }
  function render() { const m = MC.money(pay()); $('c-out').innerHTML = m + '<small style="font:500 13px var(--sans);color:var(--muted)">/mo est.</small>'; $('pay').innerHTML = m + '<small>/mo est.</small>'; $('pay-cap').textContent = MC.money(S.down) + ' down · ' + S.term + ' mo' + (S.trade ? ' · ' + MC.money(S.trade) + ' trade' : '') + ' · adjust ↓'; }
  $('calc-btn').addEventListener('click', () => $('calc').classList.toggle('open'));
  $('c-down').addEventListener('input', () => { S.down = Number(MC.digits($('c-down').value)); render(); });
  $('c-trade').addEventListener('input', () => { S.trade = Number(MC.digits($('c-trade').value)); render(); });
  $('c-term').addEventListener('click', e => { const b = e.target.closest('[data-term]'); if (!b) return; S.term = Number(b.dataset.term); document.querySelectorAll('#c-term button').forEach(x => x.classList.toggle('on', x === b)); render(); });
  // media
  const vid = $('vid'), img = $('hero-img'), play = $('play');
  function showVideo() { if (!vid) return; vid.style.display = 'block'; if (img) img.style.display = 'none'; play && (play.style.display = 'none'); vid.play().catch(() => {}); }
  play && play.addEventListener('click', showVideo);
  document.querySelectorAll('.thumb[data-src],.thumb[data-video]').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.thumb').forEach(x => x.classList.toggle('on', x === t));
    if (t.dataset.video) return showVideo();
    if (vid) { vid.pause(); vid.style.display = 'none'; play && (play.style.display = ''); }
    if (img) { img.src = t.dataset.src; img.style.display = ''; }
  }));
})();
