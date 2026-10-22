import type {
  ActionRecord,
  ActivitySnapshot,
  AppInfo,
  CapabilityInfo,
  ChatMessage,
  CloudId,
  EditorHit,
  FoundSkill,
  HitRect,
  Learned,
  LibrarySkill,
  LinkPreview,
  MascotState,
  OpenFile,
  ProviderStatus,
  RoutineItem,
  Settings,
  SkillInfo,
  SkillTarget,
  StoredEvent,
  Suggestion,
  SuggestionRate,
  SyncReport,
  Timing,
  TreeEntry,
  UpdateInfo,
  UpdateProgress,
} from "../types";
import { invoke } from "./invoke";
import type { DiskGroup, RouterModel } from "./shapes";

/** Commands the Rust core answers: app, settings, library and editor. */
export const appApi = {
  activityOpenStart: (id: string, label: string) => invoke<void>("activity_open_start", { id, label }),
  activityOpenFinish: (id: string, ok: boolean, outcome: string) =>
    invoke<void>("activity_open_finish", { id, ok, outcome }),
  activitySnapshot: () => invoke<ActivitySnapshot>("activity_snapshot"),
  activityReconcile: () => invoke<boolean>("activity_reconcile"),
  activityCheck: (id: string) => invoke<ActivitySnapshot>("activity_check", { id }),
  activityDismiss: (id: string) => invoke<void>("activity_dismiss", { id }),
  appInfo: () => invoke<AppInfo>("app_info"),
  systemLook: () => invoke<{ transparency: boolean; batterySaver: boolean }>("system_look"),
  diagnostics: () => invoke<string>("diagnostics"),
  reportSave: () => invoke<string>("report_save"),
  cloudKeys: () => invoke<Record<CloudId, boolean>>("cloud_keys"),
  cloudKeySet: (id: CloudId, key: string) => invoke<Settings>("cloud_key_set", { id, key }),
  cloudKeyClear: (id: CloudId) => invoke<Settings>("cloud_key_clear", { id }),
  openrouterModels: () => invoke<RouterModel[]>("openrouter_models"),
  crashPending: () => invoke<string | null>("crash_pending"),
  crashDismiss: () => invoke<void>("crash_dismiss"),
  settingsGet: () => invoke<Settings>("settings_get"),
  settingsSet: (settings: Settings) => invoke<Settings>("settings_set", { settings }),
  sensorsPause: (minutes: number | null) => invoke<Settings>("sensors_pause", { minutes }),
  sensorsResume: () => invoke<Settings>("sensors_resume"),
  mascotGet: () => invoke<MascotState>("mascot_get"),
  islandSetHitRect: (rect: HitRect) => invoke<void>("island_set_hit_rect", { rect }),
  islandReady: () => invoke<void>("island_ready"),
  netStatus: () => invoke<boolean>("net_status"),
  updateStatus: () => invoke<UpdateInfo | null>("update_status"),
  updateProgress: () => invoke<UpdateProgress | null>("update_progress"),
  updateCheck: () => invoke<UpdateInfo | null>("update_check"),
  updateInstall: () => invoke<string>("update_install"),
  netCheck: (lost: boolean) => invoke<boolean>("net_check", { lost }),
  suggestionCurrent: () => invoke<Suggestion | null>("suggestion_current"),
  suggestionChoose: (id: string, index: number, priv = false) =>
    invoke<void>("suggestion_choose", { id, index, private: priv }),
  suggestionDismiss: (id: string, reason: "user" | "timeout") => invoke<void>("suggestion_dismiss", { id, reason }),
  eventsRecent: (limit = 50) => invoke<StoredEvent[]>("events_recent", { limit }),
  openSettings: () => invoke<void>("open_settings"),
  debugSetState: (state: MascotState) => invoke<void>("debug_set_state", { state }),
  debugEmitEvent: () => invoke<void>("debug_emit_event"),
  skillsList: () => invoke<SkillInfo[]>("skills_list"),
  skillSet: (id: string, enabled: boolean, auto: boolean) => invoke<Settings>("skill_set", { id, enabled, auto }),
  libraryReview: () => invoke<FoundSkill[]>("library_review"),
  libraryList: () => invoke<LibrarySkill[]>("library_list"),
  libraryImport: (names: string[]) => invoke<LibrarySkill[]>("library_import", { names }),
  librarySetTarget: (name: string, target: SkillTarget, on: boolean) =>
    invoke<LibrarySkill[]>("library_set_target", { name, target, on }),
  libraryRemove: (name: string) => invoke<LibrarySkill[]>("library_remove", { name }),
  librarySync: () => invoke<SyncReport>("library_sync"),
  libraryFetchUrl: (url: string) => invoke<LinkPreview>("library_fetch_url", { url }),
  libraryInstallFetched: (url: string, commit: string, names: string[]) =>
    invoke<LibrarySkill[]>("library_install_fetched", { url, commit, names }),
  editorTree: (root: string) => invoke<TreeEntry[]>("editor_tree", { root }),
  editorRead: (root: string, path: string) => invoke<OpenFile>("editor_read", { root, path }),
  editorWrite: (root: string, path: string, text: string, stamp: string) =>
    invoke<string>("editor_write", { root, path, text, stamp }),
  editorChanged: (root: string, path: string, stamp: string) =>
    invoke<boolean>("editor_changed", { root, path, stamp }),
  editorHead: (root: string, path: string) => invoke<string>("editor_head", { root, path }),
  editorSearch: (root: string, query: string) => invoke<EditorHit[]>("editor_search", { root, query }),
  termOpen: (root: string, cols: number, rows: number) => invoke<number>("term_open", { root, cols, rows }),
  termWrite: (id: number, data: string) => invoke<void>("term_write", { id, data }),
  termResize: (id: number, cols: number, rows: number) => invoke<void>("term_resize", { id, cols, rows }),
  termClose: (id: number) => invoke<void>("term_close", { id }),
  capabilitiesGet: (rescan = false) => invoke<CapabilityInfo>("capabilities_get", { rescan }),
  choicesReset: () => invoke<number>("choices_reset"),
  routinesToday: () => invoke<RoutineItem[]>("routines_today"),
  routinesForget: () => invoke<number>("routines_forget"),
  learnedList: () => invoke<Learned[]>("learned_list"),
  suggestionRates: () => invoke<SuggestionRate[]>("suggestion_rates"),
  diskGroups: () => invoke<DiskGroup[]>("disk_groups"),
  diskClean: (group: string, paths: string[]) => invoke<string>("disk_clean", { group, paths }),
  userGuessName: () => invoke<string>("user_guess_name"),
  focusStart: (minutes?: number) => invoke<string>("focus_start", { minutes }),
  focusStop: () => invoke<string>("focus_stop"),
  focusStatus: () => invoke<{ until: number | null; held: number }>("focus_status"),
  learnedForget: (kind: string, key: string, label: string) => invoke<void>("learned_forget", { kind, key, label }),
  learnedForgetAll: () => invoke<void>("learned_forget_all"),
  routinesRemove: (kind: string, key: string) => invoke<number>("routines_remove", { kind, key }),
  actionsRecent: (limit = 30) => invoke<ActionRecord[]>("actions_recent", { limit }),
  revealPath: (path: string) => invoke<void>("reveal_path", { path }),
  aiStatus: () => invoke<ProviderStatus[]>("ai_status"),
  aiChat: (
    id: string,
    messages: ChatMessage[],
    attach: {
      window: boolean;
      clipboard: boolean;
      page?: string | null;
      skill?: boolean;
      screen?: boolean;
      speak?: boolean;
      /** Asked by voice: answer in short spoken sentences. */
      voice?: boolean;
      /** Provider picked in Ask mode; null lets Duskie choose. */
      prefer?: string | null;
      /** Started early at a pause in speech: hidden until aiRelease. */
      hold?: boolean;
      /** "Think harder": let the local model reason before answering. */
      think?: boolean;
    },
    localOnly: boolean,
  ) => invoke<void>("ai_chat", { id, messages, attach, localOnly }),
  aiCancel: (id: string) => invoke<void>("ai_cancel", { id }),
  aiRelease: (id: string) => invoke<void>("ai_release", { id }),
  timingRecord: (name: Timing["name"], ms: number) => invoke<void>("timing_record", { name, ms }),
  timingsRecent: () => invoke<Timing[]>("timings_recent"),
};
