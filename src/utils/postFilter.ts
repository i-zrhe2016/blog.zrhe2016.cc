import type { CollectionEntry } from "astro:content";
import { PUBLIC_PRERELEASE } from "astro:env/client";
import config from "@/config";
import { isPostVisible } from "./postVisibility";

/**
 * Determines whether a post is eligible to be listed/rendered.
 *
 * - Excludes drafts always
 * - Excludes `prerelease` posts outside dev and preview-branch builds
 * - In production, excludes scheduled posts until `pubDatetime` minus the configured margin
 * - In dev, always shows non-draft posts to make authoring easier
 */
export function postFilter({ data }: CollectionEntry<"posts">) {
  return isPostVisible(data, {
    dev: import.meta.env.DEV,
    prereleaseBuild: PUBLIC_PRERELEASE,
    margin: config.posts.scheduledPostMargin,
  });
}
