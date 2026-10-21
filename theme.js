// Light by default. Read the explicit user preference before first paint.
try {
  if (localStorage.getItem('indielab_theme') === 'dark') document.documentElement.dataset.theme = 'dark';
} catch { /* Storage restrictions must not prevent reading. */ }
