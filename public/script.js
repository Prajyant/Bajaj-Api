"use strict";

const $ = (id) => document.getElementById(id);

const els = {
  apiUrl: $("apiUrl"),
  dataInput: $("dataInput"),
  submitBtn: $("submitBtn"),
  sampleBtn: $("sampleBtn"),
  clearBtn: $("clearBtn"),
  error: $("error"),
  empty: $("empty"),
  output: $("output"),
  identity: $("identity"),
  summaryCards: $("summaryCards"),
  hierarchies: $("hierarchies"),
  invalid: $("invalid"),
  duplicates: $("duplicates"),
  rawJson: $("rawJson"),
  spinner: document.querySelector("#submitBtn .spinner"),
};

const SAMPLE = [
  "A->B", "A->C", "B->D", "C->E", "E->F",
  "X->Y", "Y->Z", "Z->X",
  "P->Q", "Q->R",
  "G->H", "G->H", "G->I",
  "hello", "1->2", "A->",
].join("\n");

els.apiUrl.value = `${window.location.origin}/bfhl`;

function esc(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

function parseInput(raw) {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function setLoading(loading) {
  els.submitBtn.disabled = loading;
  els.spinner.hidden = !loading;
}

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = false;
}

function clearError() {
  els.error.hidden = true;
  els.error.textContent = "";
}

function renderTree(treeObj, isRootLevel = true) {
  const keys = Object.keys(treeObj);
  if (keys.length === 0) return "";

  const items = keys
    .map((key) => {
      const childMarkup = renderTree(treeObj[key], false);
      const pillClass = isRootLevel ? "node-pill is-root" : "node-pill";
      return `<li><span class="${pillClass}">${esc(key)}</span>${childMarkup}</li>`;
    })
    .join("");

  return `<ul>${items}</ul>`;
}

function renderHierarchies(hierarchies) {
  if (!hierarchies.length) {
    els.hierarchies.innerHTML = `<p class="chips"><span class="none">No hierarchies.</span></p>`;
    return;
  }

  els.hierarchies.innerHTML = hierarchies
    .map((h) => {
      const isCycle = h.has_cycle === true;
      const tag = isCycle
        ? `<span class="tag tag--cycle">cycle</span>`
        : `<span class="tag tag--tree">tree</span>`;
      const depthTag =
        typeof h.depth === "number"
          ? `<span class="tag tag--depth">depth ${h.depth}</span>`
          : "";

      const body = isCycle
        ? `<div class="cycle-note">Cycle detected — no tree structure.</div>`
        : `<div class="tree">${renderTree(h.tree)}</div>`;

      return `
        <div class="hcard">
          <div class="hcard__head">
            <span class="hcard__root">${esc(h.root)}</span>
            ${tag}${depthTag}
          </div>
          ${body}
        </div>`;
    })
    .join("");
}

function renderChips(container, items, className, emptyText) {
  if (!items || !items.length) {
    container.innerHTML = `<span class="none">${esc(emptyText)}</span>`;
    return;
  }
  container.innerHTML = items
    .map((item) => `<span class="chip ${className}">${esc(item || "(empty)")}</span>`)
    .join("");
}

function renderResult(data) {
  els.empty.hidden = true;
  els.output.hidden = false;

  els.identity.innerHTML = [
    ["user_id", data.user_id],
    ["email_id", data.email_id],
    ["college_roll_number", data.college_roll_number],
  ]
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `<span><b>${esc(k)}</b> ${esc(v)}</span>`)
    .join("");

  const s = data.summary || {};
  els.summaryCards.innerHTML = `
    <div class="card"><div class="num">${esc(s.total_trees ?? 0)}</div><div class="lbl">Trees</div></div>
    <div class="card"><div class="num cycles">${esc(s.total_cycles ?? 0)}</div><div class="lbl">Cycles</div></div>
    <div class="card"><div class="num root">${esc(s.largest_tree_root ?? "—")}</div><div class="lbl">Largest root</div></div>`;

  renderHierarchies(data.hierarchies || []);
  renderChips(els.invalid, data.invalid_entries, "chip--invalid", "None");
  renderChips(els.duplicates, data.duplicate_edges, "chip--dup", "None");

  els.rawJson.textContent = JSON.stringify(data, null, 2);
}

async function submit() {
  clearError();
  const data = parseInput(els.dataInput.value);
  const url = els.apiUrl.value.trim() || "/bfhl";

  if (!data.length) {
    showError("Please enter at least one edge (e.g. A->B).");
    return;
  }

  setLoading(true);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    const text = await res.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Unexpected response (HTTP ${res.status}).`);
    }

    if (!res.ok) {
      throw new Error(payload.error || `Request failed (HTTP ${res.status}).`);
    }

    renderResult(payload);
  } catch (err) {
    const msg =
      err instanceof TypeError
        ? "Could not reach the API. Check the endpoint URL and that the server is running."
        : err.message;
    showError(msg);
  } finally {
    setLoading(false);
  }
}

els.submitBtn.addEventListener("click", submit);
els.sampleBtn.addEventListener("click", () => {
  els.dataInput.value = SAMPLE;
  clearError();
});
els.clearBtn.addEventListener("click", () => {
  els.dataInput.value = "";
  clearError();
  els.output.hidden = true;
  els.empty.hidden = false;
});
els.dataInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
});
