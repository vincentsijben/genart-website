'use strict';

/* Staff rendering helpers (abcjs). */
const Staff = (() => {
  // abcjs puts its responsive sizing styles on the target element, so render into a fresh inner div.
  function target(el) {
    el.innerHTML = '';
    const inner = document.createElement('div');
    el.appendChild(inner);
    return inner;
  }

  function header(extra = '') {
    return 'X:1\nM:none\nL:1\n%%stretchlast true\n' + extra + 'K:C clef=treble\n';
  }

  /** Render a single written note on a treble staff. */
  function renderNote(el, note, { staffwidth = 150, scale = 1 } = {}) {
    const abc = header() + Notes.toAbc(note) + ' |]\n';
    ABCJS.renderAbc(target(el), abc, {
      staffwidth,
      scale,
      add_classes: true,
      responsive: 'resize',
      paddingtop: 10,
      paddingbottom: 10,
      paddingleft: 10,
      paddingright: 10,
    });
  }

  /** Render one line of notes (one note per bar) with the Dutch names as lyrics. */
  function renderLine(el, notes, { staffwidth = 720 } = {}) {
    const music = notes.map((n) => Notes.toAbc(n)).join(' | ') + ' |]';
    const lyrics = notes.map((n) => Notes.dutchName(n)).join(' ');
    const abc = header('%%vocalfont Helvetica 17\n') + music + '\nw: ' + lyrics + '\n';
    ABCJS.renderAbc(target(el), abc, {
      staffwidth,
      add_classes: true,
      responsive: 'resize',
      paddingtop: 6,
      paddingbottom: 6,
      paddingleft: 0,
      paddingright: 4,
    });
    centerLyrics(el);
  }

  function noteheadCenter(text) {
    const head = text.parentNode.querySelector('.abcjs-notehead');
    const box = (head || text).getBBox();
    return box.x + box.width / 2;
  }

  /** abcjs centres lyrics on the notehead's left edge; move each name to the notehead's centre. */
  function centerLyrics(el) {
    el.querySelectorAll('.abcjs-lyric').forEach((text) => {
      const cx = noteheadCenter(text);
      text.setAttribute('text-anchor', 'middle');
      [text, ...text.querySelectorAll('tspan')].forEach((t) => t.setAttribute('x', cx));
    });
  }

  /** Draw a writing line under each (hidden) lyric so students can fill in the name. */
  function addWritingLines(el, width = 44) {
    const ns = 'http://www.w3.org/2000/svg';
    el.querySelectorAll('.abcjs-lyric').forEach((text) => {
      const box = text.getBBox();
      const cx = noteheadCenter(text);
      const y = box.y + box.height + 4;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', cx - width / 2);
      line.setAttribute('x2', cx + width / 2);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      line.setAttribute('class', 'write-line');
      text.parentNode.appendChild(line);
    });
  }

  return { renderNote, renderLine, addWritingLines, centerLyrics };
})();
