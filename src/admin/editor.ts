import { EditorView, basicSetup } from "codemirror";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { keymap } from "@codemirror/view";
import {
  joinMarkdown,
  splitMarkdown,
  validateMarkdown,
  validatePostPath,
  validImage,
  imageTypes,
  type Metadata,
} from "./content";
import { readDrafts, writeDraft, type Draft } from "./storage";
import { renderPreview } from "./preview";
import { previewSource } from "./preview-source";
import { articleRoute } from "./article-url";

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);
const message = (text: string, error = false) => {
  $("notice").textContent = text;
  $("notice").dataset.error = String(error);
};
const failure = (e: unknown) =>
  message(e instanceof Error ? e.message : String(e), true);
const drafts = new Map<string, Draft>();
let current: Draft | undefined;
let view: EditorView;
let editorExtensions: Extension[] = [];
const editability = new Compartment();
let switching = false;
let publishing = false;
let persistedRaw = "";
let timer: ReturnType<typeof setTimeout>;
let pollTimer: ReturnType<typeof setTimeout>;
let previewRevision = 0;
let openRevision = 0;
const objectUrls = new Map<string, string>();
let remote: { path: string; sha: string; markdown: string } | undefined;

class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.headers.get("Content-Type")?.includes("application/json"))
    throw new Error("登录已过期，请刷新页面重新登录；本地草稿仍可恢复。");
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error || `请求失败 (${response.status})`,
      response.status
    );
  return data;
}
function dirty(draft: Draft) {
  return draft.raw !== draft.baseRaw || !draft.baseSha;
}
function renderRecovery() {
  const select = $<HTMLSelectElement>("local-draft");
  select.replaceChildren(new Option("选择本地草稿…", ""));
  for (const draft of [...drafts.values()].sort(
    (a, b) => b.updatedAt - a.updatedAt
  )) {
    let title = draft.path;
    try {
      title = String(splitMarkdown(draft.raw).metadata.title || title);
    } catch {
      /* Keep source editable. */
    }
    select.add(
      new Option(`${title} · ${draft.path.split("/").pop()}`, draft.path)
    );
  }
}
let postPaths: Promise<Record<string, string>> | undefined;
async function openLink() {
  const revision = ++openRevision;
  const route = articleRoute(
    input("article-url").value,
    document.body.dataset.publicOrigin!
  );
  postPaths ??= fetch("/admin/post-paths.json", {
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async response => {
      if (
        !response.ok ||
        !response.headers.get("Content-Type")?.includes("application/json")
      ) {
        postPaths = undefined;
        throw new Error(
          "文章链接索引读取失败，请刷新页面重新登录；本地草稿仍可恢复。"
        );
      }
      return response.json();
    })
    .catch(error => {
      postPaths = undefined;
      throw error;
    });
  const path = (await postPaths)[route];
  if (revision !== openRevision || publishing) return;
  if (!path)
    throw new Error(
      "该链接不是当前博客已构建的 Markdown 文章，请检查网址或等待部署完成。"
    );
  await openPost(validatePostPath(path), revision);
}
function selectView(mode: string) {
  document.querySelector<HTMLElement>(".panes")!.dataset.view = mode;
  for (const key of ["edit", "preview"])
    $("view-" + key).setAttribute("aria-pressed", String(mode === key));
  view.requestMeasure();
}
function formFromSource() {
  if (!current) return;
  try {
    const { metadata } = splitMarkdown(current.raw);
    for (const key of ["title", "description", "pubDatetime"])
      input(key).value = String(metadata[key] ?? "");
    input("tags").value = Array.isArray(metadata.tags)
      ? metadata.tags.join(", ")
      : "";
    input("featured").checked = !!metadata.featured;
  } catch {
    /* Do not clobber the form while frontmatter is being typed. */
  }
}
function resetObjectUrls() {
  ++previewRevision;
  $("preview").replaceChildren();
  $("preview-title").textContent = "";
  selectView("edit");
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
  for (const image of current?.images || [])
    objectUrls.set(
      `/images/uploads/${image.name}`,
      URL.createObjectURL(image.file)
    );
}
async function preview() {
  const revision = ++previewRevision;
  if (!current) return;
  try {
    const { title, body } = previewSource(current.raw, input("title").value);
    const html = await renderPreview(body);
    if (revision !== previewRevision) return;
    $("preview-title").textContent = title;
    $("preview").innerHTML = html;
    for (const img of $("preview").querySelectorAll("img")) {
      const source = img.getAttribute("src") || "";
      if (objectUrls.has(source)) img.src = objectUrls.get(source)!;
    }
  } catch (e) {
    if (revision === previewRevision) {
      $("preview-title").textContent = "";
      $("preview").textContent =
        `预览暂不可用：${e instanceof Error ? e.message : e}`;
    }
  }
}
function queueSave() {
  clearTimeout(timer);
  $("save-status").textContent = "正在编辑…";
  timer = setTimeout(() => {
    void save().catch(failure);
  }, 600);
}
async function save() {
  clearTimeout(timer);
  if (!current) return;
  const snapshot = structuredClone(current);
  snapshot.updatedAt = Date.now();
  try {
    await writeDraft(snapshot);
    drafts.set(snapshot.path, snapshot);
    if (current?.path === snapshot.path && current.raw === snapshot.raw) {
      persistedRaw = snapshot.raw;
      $("save-status").textContent =
        `已保存到当前浏览器 · ${new Date(snapshot.updatedAt).toLocaleTimeString("zh-CN")}`;
    }
    renderRecovery();
  } catch {
    $("save-status").textContent = "草稿保存失败，请立即导出备份";
    throw new Error(
      "浏览器无法保存草稿（可能空间不足或存储被禁用）。请导出 Markdown；待发布图片也请保留原文件。"
    );
  }
}
function loadDraft(draft: Draft) {
  switching = true;
  ++previewRevision;
  clearTimeout(pollTimer);
  current = structuredClone(draft);
  persistedRaw = drafts.has(draft.path) ? draft.raw : draft.baseRaw;
  view.setState(
    EditorState.create({ doc: draft.raw, extensions: editorExtensions })
  );
  switching = false;
  $("empty").hidden = true;
  $("editing").hidden = false;
  $("document-path").textContent = draft.path;
  $("save-status").textContent = dirty(draft)
    ? "已恢复本地草稿 · 有未发布修改"
    : "与仓库版本一致";
  $("deploy-status").textContent = "";
  $("publish").toggleAttribute("disabled", !draft.baseSha);
  formFromSource();
  resetObjectUrls();
  selectView("edit");
  $("preview").replaceChildren();
  $("preview-title").textContent = "";
  renderRecovery();
  if (draft.lastCommit) void poll(draft.lastCommit);
}
async function openPost(path: string, revision = ++openRevision) {
  if (publishing) return;
  await save();
  if (revision !== openRevision || publishing) return;
  const draft = drafts.get(path);
  if (draft) {
    loadDraft(draft);
    message("");
    return;
  }
  const data = await api<{ path: string; sha: string; markdown: string }>(
    `post?path=${encodeURIComponent(path)}`
  );
  if (revision !== openRevision || publishing) return;
  loadDraft({
    path,
    raw: data.markdown,
    baseRaw: data.markdown,
    baseSha: data.sha,
    images: [],
    updatedAt: Date.now(),
  });
  message("");
}
function replaceSource(raw: string) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: raw },
  });
}
function exportMarkdown() {
  if (!current) return;
  const blob = new Blob([current.raw], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = current.path.split("/").pop()!;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function insertImages(files: File[]) {
  if (!current || publishing) return;
  const draft = current;
  const additions: Draft["images"] = [];
  let total = draft.images.reduce((sum, image) => sum + image.file.size, 0);
  for (const file of files) {
    if (!validImage(new Uint8Array(await file.arrayBuffer()), file.type))
      throw new Error("请选择 PNG、JPEG、WebP 或 GIF 图片，每张不超过 5 MB。");
    total += file.size;
    if (
      total > 20 * 1024 * 1024 ||
      draft.images.length + additions.length >= 100
    )
      throw new Error("一次发布图片最多 100 张，总量不能超过 20 MB。");
    additions.push({
      name: `${crypto.randomUUID()}.${imageTypes[file.type]}`,
      file,
    });
  }
  if (current !== draft || publishing)
    throw new Error("文章已切换或正在发布，请稍后重新插入图片");
  current.images.push(...additions);
  resetObjectUrls();
  insert(additions.map(i => `![图片](/images/uploads/${i.name})`).join("\n"));
  await save();
}
function insert(text: string, suffix = "") {
  if (!current || publishing) return;
  let range = {
    from: view.state.selection.main.from,
    to: view.state.selection.main.to,
  };
  try {
    const { body } = splitMarkdown(current.raw);
    const start = current.raw.length - body.length;
    range = {
      from: Math.max(start, range.from),
      to: Math.max(start, range.to),
    };
  } catch {
    throw new Error("请先修复文章元数据再插入内容");
  }
  const selected = view.state.sliceDoc(range.from, range.to);
  const value = text + selected + suffix;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: value },
    selection: {
      anchor: range.from + text.length,
      head: range.from + text.length + selected.length,
    },
  });
  view.focus();
}
function setBusy(value: boolean) {
  publishing = value;
  for (const id of [
    "publish",
    "remote",
    "image",
    "open-link",
    "article-url",
    "local-draft",
  ])
    $<HTMLButtonElement>(id).disabled = value;
  $("metadata")
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea")
    .forEach(el => (el.disabled = value));
  view.dispatch({
    effects: editability.reconfigure([
      EditorState.readOnly.of(value),
      EditorView.editable.of(!value),
    ]),
  });
  renderRecovery();
}
async function publish() {
  if (!current || publishing) return;
  try {
    const { metadata, body } = validateMarkdown(current.raw);
    const original = validateMarkdown(current.baseRaw).metadata;
    if (
      !current.baseSha ||
      original.draft ||
      original.prerelease ||
      metadata.draft ||
      metadata.prerelease
    )
      throw new Error(
        "后台只允许修改已有已发布文章，不允许新建、发布草稿或更改发布状态"
      );
    const updated: Metadata = {
      ...metadata,
      modDatetime: new Date().toISOString(),
    };
    const raw =
      current.pendingRaw === current.raw
        ? current.raw
        : joinMarkdown(updated, body);
    current.pendingRaw = raw;
    ++openRevision;
    setBusy(true);
    replaceSource(raw);
    // Publication is allowed even if browser storage is unavailable; export remains available.
    try {
      await save();
    } catch (e) {
      failure(e);
    }
    $("deploy-status").textContent = "正在提交文章和图片…";
    const draft = current;
    const form = new FormData();
    form.set("path", draft.path);
    form.set("baseSha", draft.baseSha);
    form.set(
      "markdown",
      new Blob([raw], { type: "text/markdown" }),
      "article.md"
    );
    for (const image of draft.images) {
      if (raw.includes(`/images/uploads/${image.name}`))
        form.append("images", image.file, image.name);
    }
    const result = await api<{ sha: string; fileSha: string }>("publish", {
      method: "POST",
      body: form,
    });
    draft.lastCommit = result.sha;
    draft.publishedImages = draft.images
      .filter(image => raw.includes(`/images/uploads/${image.name}`))
      .map(image => image.name);
    draft.baseSha = result.fileSha;
    draft.baseRaw = raw;
    draft.pendingRaw = undefined;
    try {
      await save();
    } catch (e) {
      failure(e);
    }
    resetObjectUrls();
    $("deploy-status").textContent =
      `已提交 ${result.sha.slice(0, 7)}，等待构建部署`;
    message("文章已提交到仓库，部署完成后公开网站才会更新。");
    void poll(result.sha);
  } catch (e) {
    $("deploy-status").textContent =
      "发布未确认成功，本地修改已保留；重试前可读取远端比较。";
    failure(e);
  } finally {
    setBusy(false);
  }
}
async function poll(sha: string, attempt = 0) {
  clearTimeout(pollTimer);
  const path = current?.path;
  try {
    const data = await api<{ state: string; message: string; url?: string }>(
      `deployments/${sha}`
    );
    if (current?.path !== path || current?.lastCommit !== sha) return;
    $("deploy-status").textContent = `${data.message} · ${sha.slice(0, 7)}`;
    if (data.url) {
      const url = new URL(data.url);
      if (
        url.protocol === "https:" &&
        ["github.com", "dash.cloudflare.com"].includes(url.hostname)
      ) {
        const link = document.createElement("a");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = " 查看详情 ↗";
        $("deploy-status").append(link);
      }
    }
    if (data.state === "success" && current.publishedImages?.length) {
      const uploaded = new Set(current.publishedImages);
      current.images = current.images.filter(
        image => !uploaded.has(image.name)
      );
      current.publishedImages = [];
      resetObjectUrls();
      void save().catch(failure);
    }
    if (["success", "failed", "superseded"].includes(data.state)) return;
  } catch (e) {
    if (current?.path !== path || current?.lastCommit !== sha) return;
    $("deploy-status").textContent =
      `状态查询暂不可用：${e instanceof Error ? e.message : e}`;
  }
  if (attempt < 90)
    pollTimer = setTimeout(() => {
      void poll(sha, attempt + 1);
    }, 10_000);
  else $("deploy-status").append(" · 自动查询已结束，可重新打开文章查询。");
}
async function compareRemote() {
  if (!current || publishing) return;
  const draft = current;
  await save();
  if (current !== draft) return;
  const result = await api<{ path: string; sha: string; markdown: string }>(
    `post?path=${encodeURIComponent(draft.path)}`
  );
  if (current !== draft) return;
  remote = result;
  $<HTMLTextAreaElement>("compare-local").value = current.raw;
  $<HTMLTextAreaElement>("compare-remote").value = remote!.markdown;
  $<HTMLDialogElement>("compare-dialog").showModal();
}
async function init() {
  try {
    const theme = localStorage.getItem("blog-admin-theme");
    document.documentElement.dataset.theme =
      theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  } catch {
    /* Storage may be unavailable. */
  }
  editorExtensions = [
    editability.of([
      EditorState.readOnly.of(false),
      EditorView.editable.of(true),
    ]),
    basicSetup,
    markdown(),
    EditorView.lineWrapping,
    keymap.of([
      {
        key: "Mod-s",
        run: () => {
          void save().catch(failure);
          return true;
        },
      },
    ]),
    EditorView.updateListener.of(update => {
      if (!update.docChanged || switching || !current) return;
      current.raw = update.state.doc.toString();
      ++previewRevision;
      formFromSource();
      queueSave();
    }),
    EditorView.domEventHandlers({
      paste(event) {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.length) return false;
        event.preventDefault();
        void insertImages(files).catch(failure);
        return true;
      },
      drop(event) {
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.length) return false;
        event.preventDefault();
        void insertImages(files).catch(failure);
        return true;
      },
      dragover(event) {
        if (event.dataTransfer?.types.includes("Files")) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    }),
  ];
  view = new EditorView({ parent: $("editor"), extensions: editorExtensions });
  try {
    for (const draft of await readDrafts()) drafts.set(draft.path, draft);
  } catch (e) {
    failure(e);
  }
  $("open-form").onsubmit = event => {
    event.preventDefault();
    if (!publishing) void openLink().catch(failure);
  };
  $("local-draft").onchange = () => {
    const path = $<HTMLSelectElement>("local-draft").value;
    if (path && !publishing) void openPost(path).catch(failure);
  };
  $("save").onclick = () => {
    void save().catch(failure);
  };
  $("export").onclick = exportMarkdown;
  $("publish").onclick = () => {
    void publish();
  };
  $("remote").onclick = () => {
    void compareRemote().catch(failure);
  };
  $("compare-close").onclick = () =>
    $<HTMLDialogElement>("compare-dialog").close();
  $("compare-export").onclick = exportMarkdown;
  $("compare-accept").onclick = () => {
    if (publishing || !remote || !current || remote.path !== current.path)
      return;
    if (
      !confirm(
        "将以远端内容替换当前本地草稿和待发布图片。请先导出需要保留的内容。"
      )
    )
      return;
    loadDraft({
      path: remote.path,
      raw: remote.markdown,
      baseRaw: remote.markdown,
      baseSha: remote.sha,
      images: [],
      updatedAt: Date.now(),
    });
    void save().catch(failure);
    $<HTMLDialogElement>("compare-dialog").close();
  };
  $("theme").onclick = () => {
    const theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("blog-admin-theme", theme);
    } catch {
      /* Nonessential preference. */
    }
  };
  $("metadata").onsubmit = e => e.preventDefault();
  $("metadata").oninput = event => {
    if (!current || publishing) return;
    try {
      const { metadata, body } = splitMarkdown(current.raw);
      const id = (event.target as HTMLElement).id;
      if (id === "tags")
        metadata.tags = input(id)
          .value.split(/[,，]/)
          .map(s => s.trim())
          .filter(Boolean);
      else if (id === "featured") metadata.featured = input(id).checked;
      else if (["title", "description", "pubDatetime"].includes(id))
        metadata[id] = input(id).value;
      replaceSource(joinMarkdown(metadata, body));
    } catch (e) {
      failure(e);
    }
  };
  document.querySelectorAll<HTMLButtonElement>("[data-insert]").forEach(
    button =>
      (button.onclick = () => {
        const snippets: Record<string, [string, string]> = {
          heading: ["\n## ", ""],
          bold: ["**", "**"],
          italic: ["*", "*"],
          link: ["[", "](https://example.com)"],
          code: ["\n```text\n", "\n```\n"],
          list: ["\n- ", ""],
        };
        const [prefix, suffix] = snippets[button.dataset.insert!]!;
        insert(prefix, suffix);
      })
  );
  $("image").onclick = () => input("image-input").click();
  input("image-input").onchange = () => {
    void insertImages(Array.from(input("image-input").files || [])).catch(
      failure
    );
    input("image-input").value = "";
  };
  for (const mode of ["edit", "preview"])
    $("view-" + mode).onclick = () => {
      selectView(mode);
      if (mode === "preview") void preview();
    };
  window.addEventListener("beforeunload", event => {
    if (publishing || (current && current.raw !== persistedRaw)) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void save().catch(failure);
  });
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("blog-admin")
      : undefined;
  channel?.addEventListener("message", () =>
    message("另一个后台标签页可能也在编辑，请避免同时修改同一篇文章。")
  );
  channel?.postMessage("opened");
  renderRecovery();
  const latest = [...drafts.values()].sort(
    (a, b) => b.updatedAt - a.updatedAt
  )[0];
  if (latest) loadDraft(latest);
}
void init().catch(failure);
