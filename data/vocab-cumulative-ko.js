/** Cumulative JLPT sets */
(function () {
  const ex = window.VOCAB_REMOTE_EXCLUSIVE || {};
  window.VOCAB_REMOTE = window.VOCAB_REMOTE || {};
  const order = ['n5','n4','n3','n2','n1'];
  function cum(level) {
    const idx = order.indexOf(level);
    if (idx < 0) return [];
    const out = [];
    for (let i = 0; i <= idx; i++) {
      const arr = ex[order[i]] || [];
      for (const w of arr) out.push(w);
    }
    return out;
  }
  window.VOCAB_REMOTE.n5 = cum('n5');
  window.VOCAB_REMOTE.n4 = cum('n4');
  window.VOCAB_REMOTE.n3 = cum('n3');
  window.VOCAB_REMOTE.n2 = cum('n2');
  window.VOCAB_REMOTE.n1 = cum('n1');
  window.VOCAB_REMOTE_META = {
    n5: 970,
    n4: 926,
    n3: 2461,
    n2: 2216,
    n1: 3894,
  };
})();
