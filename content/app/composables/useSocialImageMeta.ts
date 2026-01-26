import { computed, unref, type MaybeRef } from "vue";
import { normalizeSeoImage } from "#content/utils/page-documents";

type TransformConfig = {
  og?: string;
  twitter?: string;
};

type SocialImageMetaOptions = {
  image: MaybeRef<string | null | undefined>;
  transforms?: TransformConfig;
  card?: string;
};

const DEFAULT_TRANSFORMS: Required<TransformConfig> = {
  og: "w-1200,fo-auto",
  twitter: "w-1200,fo-auto",
};

const IMAGEKIT_HOST = "ik.imagekit.io";

const buildImageKitUrl = (source: string, transform: string): string => {
  if (!source || typeof source !== "string") {
    return source;
  }

  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    return source;
  }

  if (!parsed.hostname.endsWith(IMAGEKIT_HOST)) {
    return source;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return source;
  }

  const hasTransform = segments[1]?.startsWith("tr:");
  const base = [segments[0]];
  const rest = hasTransform ? segments.slice(2) : segments.slice(1);
  const nextPath = [`tr:${transform}`, ...rest];

  parsed.pathname = `/${[...base, ...nextPath].join("/")}`;
  return parsed.toString();
};

export const useSocialImageMeta = (options: SocialImageMetaOptions) => {
  const transforms = {
    ...DEFAULT_TRANSFORMS,
    ...(options.transforms ?? {}),
  };

  const meta = computed(() => {
    const raw = normalizeSeoImage(unref(options.image));
    if (!raw) {
      return [];
    }

    const ogImage = transforms.og
      ? buildImageKitUrl(raw, transforms.og)
      : raw;
    const twitterImage = transforms.twitter
      ? buildImageKitUrl(raw, transforms.twitter)
      : raw;

    const entries = [
      { property: "og:image", content: ogImage },
      { name: "twitter:image", content: twitterImage },
      { name: "twitter:card", content: options.card ?? "summary_large_image" },
    ];

    return entries;
  });

  return {
    socialImageMeta: meta,
  };
};
