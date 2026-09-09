/**
 * Optional progressive enhancement: client-side filter of the already-rendered table.
 * The metrics table is present in index.html without this file.
 */
(function () {
  function init() {
    const table = document.getElementById("adoption-table");
    const toolbar = document.getElementById("enhance-toolbar");
    const input = document.getElementById("control-filter");
    if (!table || !toolbar || !input) return;
    toolbar.classList.remove("hidden");

    input.addEventListener("input", function () {
      const q = input.value.trim().toLowerCase();
      const rows = table.tBodies[0] ? table.tBodies[0].rows : [];
      for (let i = 0; i < rows.length; i++) {
        const text = rows[i].textContent.toLowerCase();
        rows[i].hidden = q !== "" && text.indexOf(q) === -1;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
