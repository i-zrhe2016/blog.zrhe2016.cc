export {};
type AdminComment = { id: string; post: string; nickname: string; email: string; content: string; status: string; created_at: string };
const list = document.querySelector<HTMLDivElement>("#comments-admin-list");
const statusElement = document.querySelector<HTMLParagraphElement>("#comments-admin-status");
const filter = document.querySelector<HTMLSelectElement>("#comment-filter");
const refresh = document.querySelector<HTMLButtonElement>("#comment-refresh");

async function loadComments() {
  if (!list || !statusElement || !filter) return;
  statusElement.textContent = "加载中…";
  try {
    const response = await fetch(`/api/admin/comments?status=${encodeURIComponent(filter.value)}`);
    if (!response.ok) throw new Error((await response.json()).error || "加载失败");
    const comments: AdminComment[] = (await response.json()).comments || [];
    list.replaceChildren();
    if (!comments.length) { statusElement.textContent = "暂无评论。"; return; }
    statusElement.textContent = `${comments.length} 条评论`;
    for (const comment of comments) {
      const item = document.createElement("article"); item.className = "rounded border p-4 mb-4";
      const heading = document.createElement("p"); heading.textContent = `${comment.nickname} · ${comment.email} · ${comment.post}`;
      const body = document.createElement("p"); body.className = "my-2 whitespace-pre-wrap"; body.textContent = comment.content;
      const actions = document.createElement("div"); actions.className = "actions";
      if (comment.status === "pending" || comment.status === "rejected") actions.append(action(comment, "approve", "通过"));
      if (comment.status === "pending" || comment.status === "approved") actions.append(action(comment, "reject", "拒绝"));
      actions.append(action(comment, "delete", "删除")); item.append(heading, body, actions); list.append(item);
    }
  } catch (error) { statusElement.textContent = error instanceof Error ? error.message : "加载失败"; }
}
function action(comment: AdminComment, operation: string, label: string) {
  const button = document.createElement("button"); button.textContent = label;
  button.addEventListener("click", async () => {
    button.disabled = true;
    const response = await fetch(`/api/admin/comments/${encodeURIComponent(comment.id)}${operation === "delete" ? "" : `/${operation}`}`, { method: operation === "delete" ? "DELETE" : "POST" });
    if (!response.ok) { statusElement!.textContent = "操作失败"; button.disabled = false; return; }
    await loadComments();
  });
  return button;
}
filter?.addEventListener("change", loadComments);
refresh?.addEventListener("click", loadComments);
loadComments();
