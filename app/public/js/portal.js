(function () {
  // Reveal SSN (finance/admin only; every reveal is logged)
  document.querySelectorAll('[data-reveal]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Show the full SSN? This view is logged with your name.')) return;
    try { const j = await MC.post(`/portal/apps/${b.dataset.reveal}/reveal-ssn`, {}); const el = document.getElementById('ssn'); el.textContent = j.ssn; setTimeout(() => location.reload(), 30000); } catch (e) { MC.toast(e.message); }
  }));
  // Vehicle photos: add (resized in browser), remove, reorder
  const ph = document.getElementById('photos'); if (!ph) return;
  const keep = document.getElementById('photos_keep'), newBox = document.getElementById('new_photos'), form = document.getElementById('vform');
  ph.querySelector('input[type=file]').addEventListener('change', async e => {
    for (const f of e.target.files) { try { const d = await MC.resizeImage(f, 1600, 0.82); const div = document.createElement('div'); div.className = 'ph'; div.draggable = true; div.dataset.new = d; div.innerHTML = `<img src="${d}" alt=""><button type="button" data-rm>×</button>`; ph.insertBefore(div, ph.querySelector('.add')); } catch (err) { MC.toast(err.message); } }
    e.target.value = '';
  });
  ph.addEventListener('click', e => { if (e.target.matches('[data-rm]')) e.target.closest('.ph').remove(); });
  let drag = null;
  ph.addEventListener('dragstart', e => { drag = e.target.closest('.ph'); });
  ph.addEventListener('dragover', e => { e.preventDefault(); const t = e.target.closest('.ph'); if (t && drag && t !== drag && !t.classList.contains('add')) ph.insertBefore(drag, t); });
  form.addEventListener('submit', () => {
    const order = [...ph.querySelectorAll('.ph:not(.add)')];
    keep.value = order.filter(d => d.dataset.src).map(d => d.dataset.src).join('\n');
    newBox.innerHTML = ''; order.filter(d => d.dataset.new).forEach(d => { const t = document.createElement('input'); t.type = 'hidden'; t.name = 'new_photos'; t.value = d.dataset.new; newBox.appendChild(t); });
  });
})();
