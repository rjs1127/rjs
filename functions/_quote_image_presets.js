export const QUOTE_IMAGE_PRESET_VISIBILITY_KEY = "quote-image:preset-visibility:v1";

export const QUOTE_IMAGE_PRESET_CATALOG = [
  { key: "beige", name: "베이지", defaultVisible: true },
  { key: "dark", name: "다크", defaultVisible: true },
  { key: "gray", name: "그레이", defaultVisible: true },
  { key: "mocha", name: "모카", defaultVisible: true },
  { key: "sand", name: "샌드", defaultVisible: true },
  { key: "rosy-blush", name: "로지", defaultVisible: true },
  { key: "sky-sparkle", name: "스카이", defaultVisible: true },
  { key: "lavender-mist", name: "라벤더", defaultVisible: true },
  { key: "rose-quartz-glow", name: "로즈쿼츠", defaultVisible: true },
  { key: "serenity-breeze", name: "세레니티", defaultVisible: true },
  { key: "opal-shimmer", name: "오팔", defaultVisible: true },
  { key: "mist-layers", name: "미스트", defaultVisible: true },
  { key: "celadon-glaze", name: "청자유약", defaultVisible: true },
  { key: "ink-echo", name: "잉크잔향", defaultVisible: true },
  { key: "aurora-weave", name: "오로라결", defaultVisible: true },
  { key: "sunset-layers", name: "석양층운", defaultVisible: true },
  { key: "meteor-trails", name: "유성궤적", defaultVisible: true },
  { key: "wind-contours", name: "바람결", defaultVisible: true },
  { key: "glasshouse", name: "유리온실", defaultVisible: true },
  { key: "graphite-grain", name: "흑연결", defaultVisible: true },
  { key: "petal-flow", name: "페탈", defaultVisible: true },
  { key: "soft-glow", name: "글로우", defaultVisible: true },
  { key: "paper-tape", name: "테이프", defaultVisible: true },
  { key: "dawn-fog", name: "새벽안개", defaultVisible: true },
  { key: "hanji-gilt", name: "골드", defaultVisible: false },
  { key: "midnight-bookshop", name: "북샵", defaultVisible: false },
  { key: "watercolor-bleed", name: "워터컬러", defaultVisible: false },
  { key: "moon-ridge", name: "문라이트", defaultVisible: false },
  { key: "prism-foil", name: "프리즘", defaultVisible: false },
  { key: "frost-window", name: "서리유리", defaultVisible: false },
  { key: "tide-lines", name: "해변물결", defaultVisible: false },
  { key: "forest-haze", name: "새벽숲", defaultVisible: false },
  { key: "film-leak", name: "필름누광", defaultVisible: false },
  { key: "star-chart", name: "별자리지도", defaultVisible: false },
  { key: "firefly", name: "루미", defaultVisible: false },
  { key: "riso-dots", name: "리소", defaultVisible: false },
  { key: "cyan-plan", name: "시안", defaultVisible: false },
  { key: "dot-note", name: "도트", defaultVisible: false },
  { key: "velvet-drape", name: "커튼", defaultVisible: false },
  { key: "postage", name: "스탬프", defaultVisible: false },
  { key: "terrazzo", name: "테라조", defaultVisible: false },
  { key: "neon-edge", name: "네온", defaultVisible: false },
  { key: "gingham", name: "깅엄", defaultVisible: false },
  { key: "stitch", name: "스티치", defaultVisible: false },
];

export async function readQuoteImagePresetVisibility(kv) {
  const raw = await kv.get(QUOTE_IMAGE_PRESET_VISIBILITY_KEY, "json");
  const overrides = raw && typeof raw.overrides === "object" && raw.overrides ? raw.overrides : {};
  return { overrides, updatedAt: raw?.updatedAt || null };
}

export function resolveQuoteImagePresetCatalog(overrides = {}) {
  return QUOTE_IMAGE_PRESET_CATALOG.map((preset) => ({
    ...preset,
    visible: typeof overrides[preset.key] === "boolean" ? overrides[preset.key] : preset.defaultVisible,
  }));
}
