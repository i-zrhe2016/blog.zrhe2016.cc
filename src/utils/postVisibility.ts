export type VisibilityInput = {
  draft?: boolean;
  prerelease?: boolean;
  pubDatetime: Date | string | number;
};

export type VisibilityOptions = {
  /** Always show everything except drafts, as in local development. */
  dev: boolean;
  /** Only set on preview-branch builds. */
  prereleaseBuild: boolean;
  /** Scheduled-post margin in milliseconds. */
  margin?: number;
  now?: number;
};

/**
 * Decides whether a post may be listed or rendered.
 *
 * - Drafts are always excluded.
 * - `prerelease: true` posts only appear in dev and preview-branch builds,
 *   so pushing one to the production branch never publishes it.
 * - Scheduled posts stay hidden until `pubDatetime` minus the configured margin.
 */
export function isPostVisible(
  data: VisibilityInput,
  options: VisibilityOptions
) {
  if (data.draft) return false;
  if (data.prerelease && !options.dev && !options.prereleaseBuild) return false;
  if (options.dev) return true;
  const margin = options.margin ?? 0;
  const now = options.now ?? Date.now();
  return now > new Date(data.pubDatetime).getTime() - margin;
}
