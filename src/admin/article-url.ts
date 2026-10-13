/** Validate before URL normalization can hide traversal or encoded separators. */
export function articleRoute(value: string, publicOrigin: string): string {
  const text = value.trim();
  if (!/^https:\/\//i.test(text) || /[\\\s\u0000-\u001f]/.test(text))
    throw new Error("请输入本站完整的 HTTPS 文章链接");
  const url = new URL(text);
  if (url.origin !== publicOrigin || url.username || url.password)
    throw new Error("只能打开本站的文章链接");
  const rawPath = text.match(/^https:\/\/[^/?#]+([^?#]*)/i)?.[1] || "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    throw new Error("文章链接编码无效");
  }
  if (
    /%(?:2f|5c|25)/i.test(rawPath) ||
    /[\\\u0000-\u001f]/.test(decoded) ||
    decoded.split("/").some(segment => segment === "." || segment === "..") ||
    !/^\/posts\/[^/]+(?:\/[^/]+)*\/?$/.test(decoded)
  )
    throw new Error("无效文章链接，请使用博客文章页面的网址");
  return decoded.replace(/\/$/, "");
}
