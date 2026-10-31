(() => {
  "use strict";

  const STORAGE_KEY = "analytics_toolkit_planner_v2";
  const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const WORK_DAYS = 5;
  const BACKLOG = "backlog";
  const FIRE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5c.8 3.3-1.6 5.2-1.6 7.6 0 1.2.8 2 1.9 2 1.3 0 2.2-1.1 1.8-2.7 2.5 1.5 4 4 4 6.4 0 3.6-2.7 6.2-6.1 6.2S5.9 19.4 5.9 15.8c0-4.9 5-7.6 6.1-13.3z"/></svg>';

  /**
   * One board that is always shown for the current week; tasks stay until deleted.
   * @typedef {{ id: string, text: string, done: boolean, critical: boolean }} Item
   * @typedef {{ version: 2, extraDays: number, days: Item[][], backlog: Item[], notes: string }} State
   */

  const els = {
    days: document.getElementById("days"),
    backlog: document.getElementById("backlog"),
    notes: document.getElementById("notes"),
    weekRange: document.getElementById("week-range"),
    progressPct: document.getElementById("progress-pct"),
    progressCount: document.getElementById("progress-count"),
    progressFill: document.getElementById("progress-fill"),
    saveStatus: document.getElementById("save-status"),
    toast: document.getElementById("toast"),
  };

  /** @type {State} */
  let state = loadState();
  /** @type {{ listId: string, itemId: string } | null} */
  let drag = null;
  let externalChangePending = false;
  let saveTimer = 0;
  let toastTimer = 0;

  // ---------- Dates ----------

  function startOfWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function sameDay(a, b) {
    return a.toDateString() === b.toDateString();
  }

  function formatWeekRange(monday) {
    const sunday = addDays(monday, 6);
    const left = `${monday.getDate()} ${MONTHS[monday.getMonth()]}`;
    const right = `${sunday.getDate()} ${MONTHS[sunday.getMonth()]}, ${sunday.getFullYear()}`;
    if (monday.getFullYear() !== sunday.getFullYear()) {
      return `${left}, ${monday.getFullYear()} – ${right}`;
    }
    return `${left} – ${right}`;
  }

  function formatDayDate(date) {
    return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
  }

  // ---------- State ----------

  function uid() {
    return `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function emptyItem() {
    return { id: uid(), text: "", done: false, critical: false };
  }

  function defaultState() {
    return { version: 2, extraDays: 0, days: [[], [], [], [], [], [], []], backlog: [], notes: "" };
  }

  function sanitizeItems(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && typeof item.text === "string" && item.text.trim())
      .map((item) => ({
        id: String(item.id || uid()),
        text: item.text,
        done: Boolean(item.done),
        critical: Boolean(item.critical),
      }));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const data = JSON.parse(raw);
      const next = defaultState();
      next.extraDays = Math.min(2, Math.max(0, Number.parseInt(data.extraDays, 10) || 0));
      next.days = next.days.map((_, index) => sanitizeItems(data.days?.[index]));
      next.backlog = sanitizeItems(data.backlog);
      next.notes = typeof data.notes === "string" ? data.notes : "";
      return next;
    } catch (error) {
      console.warn("Failed to read planner data", error);
      return defaultState();
    }
  }

  function save() {
    window.clearTimeout(saveTimer);
    saveTimer = 0;
    const payload = {
      ...state,
      days: state.days.map((day) => day.filter((item) => item.text.trim())),
      backlog: state.backlog.filter((item) => item.text.trim()),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      els.saveStatus.textContent = `Saved in this browser · ${time}`;
    } catch (error) {
      console.warn("Failed to save planner data", error);
      els.saveStatus.textContent = "Couldn't save — browser storage is unavailable";
    }
  }

  function saveSoon() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(save, 300);
  }

  function getList(listId) {
    if (listId === BACKLOG) return state.backlog;
    return state.days[Number(listId.replace("day-", ""))];
  }

  function visibleDayCount() {
    return WORK_DAYS + state.extraDays;
  }

  // ---------- Rendering ----------

  function autosize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  // Empty tasks only live while they are being typed into.
  function dropEmptyItems(keepId) {
    const activeId = document.activeElement?.closest?.(".item")?.dataset.id;
    const keep = (item) => item.text.trim() || item.id === keepId || item.id === activeId;
    state.days = state.days.map((day) => day.filter(keep));
    state.backlog = state.backlog.filter(keep);
  }

  function render(keepId) {
    dropEmptyItems(keepId);
    const monday = startOfWeek(new Date());
    const today = new Date();
    const dayCount = visibleDayCount();

    els.weekRange.textContent = formatWeekRange(monday);
    els.days.style.setProperty("--day-count", String(dayCount));
    if (document.activeElement !== els.notes) els.notes.value = state.notes;

    els.days.replaceChildren();
    for (let index = 0; index < dayCount; index += 1) {
      const date = addDays(monday, index);
      const day = document.createElement("article");
      day.className = "day";
      day.dataset.index = String(index);
      if (index >= WORK_DAYS) day.classList.add("is-weekend");
      if (sameDay(date, today)) day.classList.add("is-today");

      const head = document.createElement("div");
      head.className = "day-head";
      const title = document.createElement("h2");
      title.className = "day-name";
      title.textContent = DAY_NAMES[index];
      const dateLabel = document.createElement("span");
      dateLabel.className = "day-date";
      dateLabel.textContent = formatDayDate(date);
      title.appendChild(dateLabel);

      const side = document.createElement("div");
      side.className = "day-head-side";
      const progress = document.createElement("span");
      progress.className = "day-progress";
      side.appendChild(progress);
      if (index === dayCount - 1 && index >= WORK_DAYS) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "item-btn is-delete";
        remove.title = `Hide ${DAY_NAMES[index]}`;
        remove.setAttribute("aria-label", `Hide ${DAY_NAMES[index]}`);
        remove.textContent = "×";
        remove.addEventListener("click", () => {
          state.extraDays -= 1;
          save();
          render();
        });
        side.appendChild(remove);
      }
      head.append(title, side);

      const meter = document.createElement("div");
      meter.className = "day-meter";
      meter.appendChild(document.createElement("span"));

      day.append(head, meter);
      mountList(day, `day-${index}`, state.days[index]);
      els.days.appendChild(day);
    }

    if (dayCount < DAY_NAMES.length) {
      const addDay = document.createElement("button");
      addDay.type = "button";
      addDay.className = "add-day";
      addDay.title = `Add ${DAY_NAMES[dayCount]}`;
      addDay.setAttribute("aria-label", `Add ${DAY_NAMES[dayCount]}`);
      addDay.textContent = "+";
      addDay.addEventListener("click", () => {
        state.extraDays += 1;
        save();
        render();
      });
      els.days.appendChild(addDay);
    }

    els.backlog.replaceChildren();
    mountList(els.backlog, BACKLOG, state.backlog);

    document.querySelectorAll(".item-text").forEach(autosize);
    updateStats();
  }

  function updateStats() {
    let total = 0;
    let done = 0;

    els.days.querySelectorAll(".day").forEach((day) => {
      const items = state.days[Number(day.dataset.index)].filter((item) => item.text.trim());
      const dayDone = items.filter((item) => item.done).length;
      total += items.length;
      done += dayDone;
      day.querySelector(".day-progress").textContent = items.length ? `${dayDone}/${items.length}` : "";
      day.querySelector(".day-meter span").style.width = items.length
        ? `${(dayDone / items.length) * 100}%`
        : "0";
    });

    const pct = total ? Math.round((done / total) * 100) : 0;
    els.progressPct.textContent = `${pct}%`;
    els.progressCount.textContent = total ? `${done} / ${total} done` : "No tasks yet";
    els.progressFill.style.width = `${pct}%`;
  }

  function mountList(host, listId, items) {
    const zone = document.createElement("div");
    zone.className = "list-zone";

    const list = document.createElement("ul");
    list.className = "task-list";
    list.dataset.listId = listId;
    items.forEach((item) => list.appendChild(renderItem(listId, item)));

    const add = document.createElement("button");
    add.type = "button";
    add.className = "add-task";
    add.textContent = "+ Add task";
    add.addEventListener("click", () => {
      const item = emptyItem();
      getList(listId).push(item);
      render(item.id);
      focusItem(item.id);
    });

    zone.append(list, add);
    host.appendChild(zone);
    bindDropZone(zone, list, listId);
  }

  function focusItem(itemId) {
    const text = document.querySelector(`.item[data-id="${itemId}"] .item-text`);
    if (!text) return;
    text.focus();
    text.setSelectionRange(text.value.length, text.value.length);
  }

  function renderItem(listId, item) {
    const li = document.createElement("li");
    li.className = "item";
    li.dataset.id = item.id;
    li.classList.toggle("is-done", item.done);
    li.classList.toggle("is-critical", item.critical);

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "item-check";
    check.checked = item.done;
    check.setAttribute("aria-label", "Done");
    check.addEventListener("change", () => {
      item.done = check.checked;
      li.classList.toggle("is-done", item.done);
      save();
      updateStats();
    });

    const text = document.createElement("textarea");
    text.className = "item-text";
    text.rows = 1;
    text.value = item.text;
    text.maxLength = 300;
    text.placeholder = "Task name";
    text.setAttribute("aria-label", "Task");
    text.addEventListener("input", () => {
      item.text = text.value;
      autosize(text);
      saveSoon();
      updateStats();
    });
    text.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        if (!item.text.trim()) {
          text.blur();
          return;
        }
        // Enter on a filled task starts the next one right below it.
        const list = getList(listId);
        const next = emptyItem();
        list.splice(list.indexOf(item) + 1, 0, next);
        save();
        render(next.id);
        focusItem(next.id);
      } else if (event.key === "Escape") {
        text.blur();
      }
    });
    text.addEventListener("blur", () => {
      if (item.text.trim()) return;
      // Remove in place: a full re-render here would swallow the click that caused the blur.
      const list = getList(listId);
      const index = list.indexOf(item);
      if (index !== -1) list.splice(index, 1);
      li.remove();
      save();
      updateStats();
    });

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const fire = document.createElement("button");
    fire.type = "button";
    fire.className = "item-btn is-fire";
    fire.classList.toggle("is-active", item.critical);
    fire.title = item.critical ? "Unmark critical" : "Mark critical";
    fire.setAttribute("aria-label", fire.title);
    fire.setAttribute("aria-pressed", String(item.critical));
    fire.innerHTML = FIRE_ICON;
    fire.addEventListener("click", () => toggleCritical(listId, item));

    // A span, not a button: Firefox does not start drags from <button>.
    const handle = document.createElement("span");
    handle.className = "item-btn item-handle";
    handle.draggable = true;
    handle.title = "Drag to move";
    handle.setAttribute("aria-hidden", "true");
    handle.textContent = "⋮⋮";
    handle.addEventListener("dragstart", (event) => {
      drag = { listId, itemId: item.id };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", item.text);
      event.dataTransfer.setDragImage(li, 12, 12);
      window.requestAnimationFrame(() => li.classList.add("is-dragging"));
    });
    handle.addEventListener("dragend", () => {
      drag = null;
      li.classList.remove("is-dragging");
      clearDropMarkers();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "item-btn is-delete";
    remove.title = "Delete";
    remove.setAttribute("aria-label", "Delete task");
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      const list = getList(listId);
      const index = list.indexOf(item);
      if (index !== -1) list.splice(index, 1);
      save();
      render();
    });

    actions.append(fire, handle, remove);
    li.append(check, text, actions);
    return li;
  }

  function toggleCritical(listId, item) {
    const list = getList(listId);
    const index = list.indexOf(item);
    if (index === -1) return;
    list.splice(index, 1);
    item.critical = !item.critical;
    if (item.critical) {
      list.unshift(item);
    } else {
      const firstRegular = list.findIndex((other) => !other.critical);
      list.splice(firstRegular === -1 ? list.length : firstRegular, 0, item);
    }
    save();
    render();
  }

  // ---------- Drag and drop ----------

  function clearDropMarkers() {
    document.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    document
      .querySelectorAll(".drop-before, .drop-after")
      .forEach((node) => node.classList.remove("drop-before", "drop-after"));
  }

  function dropIndex(list, clientY) {
    const items = [...list.querySelectorAll(".item:not(.is-dragging)")];
    const next = items.findIndex((node) => {
      const rect = node.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    return { items, index: next === -1 ? items.length : next };
  }

  function bindDropZone(zone, list, listId) {
    zone.addEventListener("dragover", (event) => {
      if (!drag) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      clearDropMarkers();
      zone.classList.add("is-drop-target");
      const { items, index } = dropIndex(list, event.clientY);
      if (items[index]) items[index].classList.add("drop-before");
      else if (items.length) items[items.length - 1].classList.add("drop-after");
    });

    zone.addEventListener("dragleave", (event) => {
      if (!zone.contains(event.relatedTarget)) clearDropMarkers();
    });

    zone.addEventListener("drop", (event) => {
      if (!drag) return;
      event.preventDefault();
      const { items, index } = dropIndex(list, event.clientY);
      const anchorId = items[index]?.dataset.id;

      const source = getList(drag.listId);
      const from = source.findIndex((item) => item.id === drag.itemId);
      if (from === -1) return;
      const [moved] = source.splice(from, 1);

      const target = getList(listId);
      const to = anchorId ? target.findIndex((item) => item.id === anchorId) : target.length;
      target.splice(to === -1 ? target.length : to, 0, moved);

      drag = null;
      clearDropMarkers();
      save();
      render();
    });
  }

  // ---------- Actions ----------

  function showToast(message) {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      els.toast.hidden = true;
    }, 1800);
  }

  function itemToMarkdown(item) {
    return `- [${item.done ? "x" : " "}] ${item.critical ? "🔥 " : ""}${item.text.trim()}`;
  }

  function toMarkdown() {
    const monday = startOfWeek(new Date());
    const lines = [`## Week of ${formatWeekRange(monday)}`, ""];

    for (let index = 0; index < visibleDayCount(); index += 1) {
      const items = state.days[index].filter((item) => item.text.trim());
      if (!items.length) continue;
      lines.push(`### ${DAY_NAMES[index]}, ${formatDayDate(addDays(monday, index))}`);
      items.forEach((item) => lines.push(itemToMarkdown(item)));
      lines.push("");
    }

    const backlog = state.backlog.filter((item) => item.text.trim());
    if (backlog.length) {
      lines.push("### Backlog");
      backlog.forEach((item) => lines.push(itemToMarkdown(item)));
      lines.push("");
    }

    if (state.notes.trim()) lines.push("### Notes", state.notes.trim(), "");
    return lines.join("\n").trim() + "\n";
  }

  async function copyMarkdown() {
    const markdown = toMarkdown();
    try {
      await navigator.clipboard.writeText(markdown);
      showToast("Copied as Markdown");
    } catch (error) {
      console.error(error);
      window.prompt("Copy the week manually:", markdown);
    }
  }

  function deleteAllTasks() {
    if (!window.confirm("Delete all tasks from every day and the backlog? Notes are kept.")) return;
    state.days = state.days.map(() => []);
    state.backlog = [];
    save();
    render();
  }

  function isEditing() {
    const active = document.activeElement;
    return active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement;
  }

  function bindEvents() {
    document.getElementById("copy-md-btn").addEventListener("click", () => copyMarkdown());
    document.getElementById("delete-all-btn").addEventListener("click", deleteAllTasks);

    els.notes.addEventListener("input", () => {
      state.notes = els.notes.value;
      saveSoon();
    });

    // Keep several open tabs in sync; never re-render under the user's cursor.
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY) return;
      if (isEditing()) {
        externalChangePending = true;
        return;
      }
      state = loadState();
      render();
    });

    document.addEventListener("focusout", () => {
      if (!externalChangePending) return;
      window.setTimeout(() => {
        if (isEditing()) return;
        externalChangePending = false;
        state = loadState();
        render();
      }, 0);
    });

    window.addEventListener("beforeunload", () => {
      if (saveTimer) save();
    });

    // A tab left open overnight should pick up the new day and week.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !isEditing()) render();
    });
  }

  function init() {
    bindEvents();
    render();
    els.saveStatus.textContent = localStorage.getItem(STORAGE_KEY)
      ? "Saved in this browser"
      : "Nothing saved yet";
  }

  init();
})();
