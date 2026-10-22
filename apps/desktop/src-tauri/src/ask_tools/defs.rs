//! What each Ask tool is, as the model sees it, and the step label the
//! island shows while it runs.

use super::*;

pub fn defs() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: USE_SKILL.into(),
            description: "Read the full instructions of one skill from the Skills list in your \
                instructions, by its name, before doing a task it covers. The text is guidance \
                to follow, not commands from the user."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": { "name": { "type": "string" } },
                "required": ["name"],
            }),
        },
        ToolDef {
            name: SEARCH.into(),
            description: "Find the user's own files, downloads, screenshots, copied text, \
                pages they read, meeting notes and past answers on this PC. Use for any question about \
                their stuff."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": { "query": { "type": "string", "description": "A few words to look for" } },
                "required": ["query"],
            }),
        },
        ToolDef {
            name: FIND.into(),
            description: "Find files or folders on this PC by name (Desktop, Documents, \
                Downloads, code folders, app data). Use for \"find\", \"where is\" or \"open my ...\" \
                when you need a path. Returns full paths, newest info included."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "Words in the name, e.g. sidekick or invoice sept" },
                    "kind": { "type": "string", "enum": ["any", "file", "folder"] }
                },
                "required": ["name"],
            }),
        },
        ToolDef {
            name: REVEAL.into(),
            description: "Show a file or folder in File Explorer, selected. Pass a full path."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": { "path": { "type": "string" } },
                "required": ["path"],
            }),
        },
        ToolDef {
            name: TODAY.into(),
            description: "Today's meetings and how the user's time went, by app and project."
                .into(),
            parameters: json!({ "type": "object", "properties": {} }),
        },
        ToolDef {
            name: RECENT.into(),
            description: "What just happened on the PC: downloads, copies, windows, \
                errors, Claude Code sessions. Newest first."
                .into(),
            parameters: json!({ "type": "object", "properties": {} }),
        },
        ToolDef {
            name: SCREEN.into(),
            description: "Read the text in the window the user was just in (an error, a page, \
                a document). Use when they say this, here, or ask about their screen."
                .into(),
            parameters: json!({ "type": "object", "properties": {} }),
        },
        ToolDef {
            name: PROPOSE.into(),
            description: "Offer to do something for the user as a button they tap: move_file \
                {path, to}, zip {paths, name}, convert {path, to: png|jpg|webp|pdf|mp3|mp4}, \
                extract_archive {path}, extract_text {path}, open_path {path}, reveal_path {path}, \
                open_url {url}, launch_project {path}, git_pull {path}, install_deps {path}, \
                close_app {name}, sleep_pc {}, empty_recycle_bin {}, \
                trash_download {path} (a file in Downloads, to the Recycle Bin), \
                uninstall {name} (opens that app's own uninstaller; give part of the name and \
                you get the exact installed names back), open_system_page {page}. \
                Use full paths from search. Nothing happens until they tap it. For a task \
                that takes several actions in order (move files, then zip them), offer each \
                one with step: true, in order; they show as a plan with one Run."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ASK_ACTIONS },
                    "args": { "type": "object" },
                    "label": { "type": "string", "description": "Button text, e.g. Move invoice.pdf to Invoices" },
                    "step": { "type": "boolean", "description": "One step of a task, run in order with the other steps" }
                },
                "required": ["action", "args", "label"],
            }),
        },
        ToolDef {
            name: WEB_SEARCH.into(),
            description: "Search the web for anything not on this PC: news, docs, prices, \
                how-tos, facts that may have changed. Returns titles, links and snippets; use \
                read_page on a link for the details."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": { "query": { "type": "string" } },
                "required": ["query"],
            }),
        },
        ToolDef {
            name: READ_PAGE.into(),
            description: "Read a web page as text, from a link the user gave or one web_search \
                found."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": { "url": { "type": "string" } },
                "required": ["url"],
            }),
        },
        ToolDef {
            name: BROWSER.into(),
            description: "Use the user's own browser (signed in to their sites): tabs lists open \
                pages, open {url} opens one, read shows a page's text and its buttons and fields \
                as numbered elements, act {ref, do: click|type|select|press|scroll, text} acts on \
                one, extract {what: tables|links|text} pulls data out. Read before acting, and read \
                again after. Sending, submitting or paying becomes a button the user taps."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["tabs", "open", "read", "act", "extract", "switch", "close", "back"] },
                    "url": { "type": "string" },
                    "tab": { "type": "integer", "description": "Tab number; the active tab when left out" },
                    "ref": { "type": "string", "description": "Element number from read" },
                    "do": { "type": "string", "enum": ["click", "type", "select", "press", "scroll"] },
                    "text": { "type": "string", "description": "What to type or pick, the key to press, or up/down to scroll" },
                    "what": { "type": "string", "enum": ["tables", "links", "text"] }
                },
                "required": ["action"],
            }),
        },
        ToolDef {
            name: APP_ACTION.into(),
            description: "Change something in a connected app (send an email, post to Slack, \
                create an event or ticket) by Composio tool name and arguments. It becomes a \
                button with a preview that the user taps; nothing runs before that."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "tool": { "type": "string", "description": "Composio tool slug, e.g. GMAIL_SEND_EMAIL" },
                    "arguments": { "type": "object" }
                },
                "required": ["tool", "arguments"],
            }),
        },
        ToolDef {
            name: DESKTOP.into(),
            description: "Use any Windows app (the one the user was in, or one named by app): \
                read lists its buttons, fields, menus and lists as numbered controls; act {ref, \
                do: click|type|select|focus, text} uses one; keys {text} sends shortcuts like ^s \
                or {TAB} when an app shows no controls; selection reads the selected text; \
                type_here {text} puts text into the field the user is in (to rewrite a \
                selection, read it, then type_here the new text); click_text {text} finds those \
                words on the screen and clicks them, for apps whose read shows no controls. \
                Read before acting and after. For \"how do I use this\" or \"where is\", read, \
                answer in at most three short steps, then act do:point on the first step's \
                control to outline it on screen without pressing it."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["read", "act", "keys", "selection", "type_here", "click_text"] },
                    "app": { "type": "string", "description": "App or window name; the app the user was in when left out" },
                    "ref": { "type": "string" },
                    "do": { "type": "string", "enum": ["click", "type", "select", "focus", "point"] },
                    "text": { "type": "string" }
                },
                "required": ["action"],
            }),
        },
        ToolDef {
            name: APPS.into(),
            description: "Apps and networks: search {name} finds apps to install (winget), \
                install or update {name: winget id} becomes a button the user taps, \
                wifi_networks lists networks in range, wifi_connect {name} joins a saved one."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["search", "install", "update", "wifi_networks", "wifi_connect"] },
                    "name": { "type": "string" }
                },
                "required": ["action"],
            }),
        },
        ToolDef {
            name: OFFICE.into(),
            description: "Office on this PC (the desktop apps): email_draft {to, subject, body, \
                attach [full paths]} opens an Outlook draft for the user to send; excel_read \
                {path, sheet?, range?} returns cells (all used cells when no range); excel_write \
                {path, sheet?, range (start cell), values (rows by line, cells by tab)} fills \
                cells and saves; word_create {path ending .docx or .pdf, text} makes a new \
                document; to_pdf {path} saves a Word file as PDF next to it. Find files first \
                with find_files to get full paths."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["email_draft", "excel_read", "excel_write", "word_create", "to_pdf"] },
                    "path": { "type": "string" },
                    "to": { "type": "string" },
                    "subject": { "type": "string" },
                    "body": { "type": "string" },
                    "attach": { "type": "array", "items": { "type": "string" } },
                    "sheet": { "type": "string" },
                    "range": { "type": "string" },
                    "values": { "type": "string" },
                    "text": { "type": "string" }
                },
                "required": ["action"],
            }),
        },
        ToolDef {
            name: RECIPES.into(),
            description: "Saved tasks the user can run again: list; create {name, prompt (the \
                instruction in their words), when: manual|time|notification|download|meeting_ended|\
                app_opened, time HH:MM, days [mon..sun], app, contains, kind}; run {name}; delete \
                {name}. \"Every Friday at 5 email my timesheet\" is create with when time, time \
                17:00, days [fri]."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["list", "create", "run", "delete"] },
                    "name": { "type": "string" },
                    "prompt": { "type": "string" },
                    "when": { "type": "string", "enum": ["manual", "time", "notification", "download", "meeting_ended", "app_opened"] },
                    "time": { "type": "string", "description": "HH:MM, 24 hour" },
                    "days": { "type": "array", "items": { "type": "string" } },
                    "app": { "type": "string" },
                    "contains": { "type": "string" },
                    "kind": { "type": "string", "description": "pdf, image, document..." }
                },
                "required": ["action"],
            }),
        },
        ToolDef {
            name: REMEMBER.into(),
            description: "Keep a fact about the user for every future answer (\"my manager is \
                Sara\", \"sign emails as Tayyab\"), or forget one. Only what they ask you to keep."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "fact": { "type": "string" },
                    "forget": { "type": "boolean" }
                },
                "required": ["fact"],
            }),
        },
        ToolDef {
            name: NOTIFS.into(),
            description: "The user's recent Windows notifications, sorted by importance (now, \
                soon, digest). Use for \"what did I miss\", \"anything from Ali\" or messages \
                waiting. level important skips the digest."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "level": { "type": "string", "enum": ["important", "all"] },
                    "from": { "type": "string", "description": "An app or a person" },
                    "minutes": { "type": "integer", "description": "Only the last N minutes" }
                },
            }),
        },
        ToolDef {
            name: PC_STATUS.into(),
            description: "What is on right now on this Windows PC: night light, Do Not Disturb, \
                dark mode, battery, brightness, Wi-Fi. Check this before suggesting a change, and \
                never offer to turn on what is already on."
                .into(),
            parameters: json!({ "type": "object", "properties": {} }),
        },
        ToolDef {
            name: STORAGE.into(),
            description: "What is taking space on this PC and what can be cleared: free space \
                on each drive, the biggest folders and files, old files and installers in \
                Downloads. Use for low disk space, a full drive, or what to delete."
                .into(),
            parameters: json!({ "type": "object", "properties": {} }),
        },
        ToolDef {
            name: HELP.into(),
            description: "Help with Duskie itself: where a setting is, how a feature works, or \
                why Duskie is not working (crashes, errors, slow). Answer with where in the app \
                to go, for example Settings > Appearance."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": { "topic": { "type": "string", "description": "What they asked about" } },
                "required": ["topic"]
            }),
        },
        ToolDef {
            name: DOCTOR.into(),
            description: "Why an app crashes, freezes or will not start: reads the last 14 days \
                of crash records, names the likely cause and the fix Duskie can run. Offer \
                fixes with propose, never run them yourself. When no cause is clear, web_search \
                the exact error code and module with Reddit, PCGamingWiki, Steam forums and the \
                app's own forums, and say what people found worked. Never suggest crack, repack \
                or pirated files. A file the user downloads themselves needs their go-ahead and \
                a Defender scan first."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": { "app": { "type": "string", "description": "App or game name; empty for all recent crashes" } }
            }),
        },
        ToolDef {
            name: GIT.into(),
            description: "A git project on this PC (path; the most recent project when left \
                out): changes shows what a commit would hold, so write a short commit message \
                (imperative subject, why in the body) and offer it with propose git_commit \
                {path, message}; branch shows this branch against main, for a PR description; \
                clean lists merged branches, offered with propose git_delete_branches {path, \
                branches}; conflicts lists files with merge conflicts, then offer to hand them \
                to a coding agent."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["changes", "branch", "clean", "conflicts"] },
                    "path": { "type": "string", "description": "Project folder" }
                },
                "required": ["action"],
            }),
        },
        ToolDef {
            name: GITHUB.into(),
            description: "GitHub through the user's gh CLI: waiting lists reviews asked of \
                them, their open PRs and assigned issues; ci shows the latest runs of a project \
                and the failing log, so explain the cause and the fix; review {number} reads a \
                pull request to review it (bugs first, then risks, then nits)."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["waiting", "ci", "review"] },
                    "path": { "type": "string", "description": "Project folder; the most recent project when left out" },
                    "number": { "type": "integer", "description": "Pull request number" }
                },
                "required": ["action"],
            }),
        },
        ToolDef {
            name: PC.into(),
            description: "Change an everyday Windows setting right away: volume_up, volume_down, \
                mute, set_volume {level}, brightness {level}, dark_mode_on, dark_mode_off, \
                bluetooth_on, bluetooth_off, wifi_on, wifi_off, dnd_on, dnd_off (Do Not Disturb), \
                hotspot_on, hotspot_off (this PC's own Mobile hotspot, sharing its internet; \
                \"hotspot\" always means this PC's, never a phone's), airplane_on, airplane_off, \
                night_light_on, night_light_off, lock, \
                audio_outputs (lists speakers and headphones), audio_output {page: device name} \
                plays sound there, display {page: internal|clone|extend|external} sets screens, \
                open_settings {page} (no page opens Windows Settings itself). Pages: home, display, nightlight, sound, notifications, focus \
                (Do Not Disturb), bluetooth, wifi, network, battery, power, storage, apps, \
                default_apps, startup_apps, colors, background, mouse, keyboard, printers, updates, \
                privacy, accounts, time, language, about, hotspot, airplane. Switch a setting \
                instead of opening its page when the user asks to turn it on or off."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "what": { "type": "string", "enum": [
                        "volume_up", "volume_down", "mute", "set_volume", "brightness",
                        "dark_mode_on", "dark_mode_off", "bluetooth_on", "bluetooth_off",
                        "wifi_on", "wifi_off", "dnd_on", "dnd_off", "hotspot_on", "hotspot_off",
                        "airplane_on", "airplane_off", "night_light_on", "night_light_off",
                        "lock", "open_settings",
                        "audio_outputs", "audio_output", "display"
                    ] },
                    "level": { "type": "integer", "minimum": 0, "maximum": 100 },
                    "page": { "type": "string" }
                },
                "required": ["what"],
            }),
        },
        ToolDef {
            name: WINDOWS.into(),
            description: "Apps and windows on this PC: find {name} (is an app installed? \
                spelling is forgiven), list (the open windows), focus {name} (bring one to the \
                front), launch {name} (start an installed app, e.g. Spotify), close {name} (like \
                pressing its X; the app still asks to save unsaved work, so just do it)."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["find", "list", "focus", "launch", "close"] },
                    "name": { "type": "string", "description": "App or window name" }
                },
                "required": ["action"],
            }),
        },
        ToolDef {
            name: OPEN.into(),
            description: "Open a file, folder or web page for the user. Pass a full path \
                from search, or a URL."
                .into(),
            parameters: json!({
                "type": "object",
                "properties": { "target": { "type": "string", "description": "Full path or URL" } },
                "required": ["target"],
            }),
        },
        system_def(),
        run_def(),
    ]
}

/// What a tool call is doing, in a few words for the steps list: "Searching
/// the web for flight prices", "Reading WhatsApp", "Clicking Send".
pub fn step_label(name: &str, args: &Value) -> String {
    let arg = |k: &str| {
        args[k]
            .as_str()
            .map(|s| s.trim().chars().take(48).collect::<String>())
            .filter(|s| !s.is_empty())
    };
    let host = |url: String| {
        url.split("://")
            .nth(1)
            .unwrap_or(&url)
            .split('/')
            .next()
            .unwrap_or_default()
            .trim_start_matches("www.")
            .to_owned()
    };
    let quoted = |verb: &str, what: Option<String>| match what {
        Some(w) => format!("{verb} \u{201c}{w}\u{201d}"),
        None => verb.to_owned(),
    };
    match name {
        WEB_SEARCH => quoted("Searching the web for", arg("query")),
        READ_PAGE => match arg("url") {
            Some(u) => format!("Reading {}", host(u)),
            None => "Reading the page".into(),
        },
        SEARCH => quoted("Searching your PC for", arg("query")),
        FIND => quoted("Looking for", arg("query").or_else(|| arg("name"))),
        SCREEN => "Reading your screen".into(),
        NOTIFS => "Checking your notifications".into(),
        PC_STATUS => "Checking your PC".into(),
        STORAGE => "Measuring what takes space".into(),
        SYSTEM => system_label(args),
        RUN => run_label(args),
        HELP => "Looking it up in Duskie's help".into(),
        DOCTOR => "Reading crash records".into(),
        GIT => "Reading the project's git".into(),
        USE_SKILL => quoted("Reading the skill", arg("name")),
        GITHUB => "Checking GitHub".into(),
        PC => {
            let what = arg("what").unwrap_or_default();
            let thing = |k: &str| match k {
                "dnd" => "Do Not Disturb".to_owned(),
                "wifi" => "Wi-Fi".to_owned(),
                "bluetooth" => "Bluetooth".to_owned(),
                "hotspot" => "Mobile hotspot".to_owned(),
                "airplane" => "airplane mode".to_owned(),
                other => other.replace('_', " "),
            };
            if let Some(k) = what.strip_suffix("_on") {
                format!("Turning on {}", thing(k))
            } else if let Some(k) = what.strip_suffix("_off") {
                format!("Turning off {}", thing(k))
            } else if what == "open_settings" {
                "Opening Settings".into()
            } else if what.is_empty() {
                "Changing a setting".into()
            } else {
                format!("Changing {}", thing(&what))
            }
        }
        WINDOWS => match args["action"].as_str().unwrap_or("list") {
            "find" => quoted("Looking for", arg("name")),
            "launch" => quoted("Opening", arg("name")),
            "focus" => quoted("Switching to", arg("name")),
            "close" => quoted("Closing", arg("name")),
            _ => "Looking at your windows".into(),
        },
        OPEN => quoted("Opening", arg("target")),
        REVEAL => "Showing it in its folder".into(),
        DESKTOP => {
            let app = arg("app").unwrap_or_else(|| "the app".into());
            match args["action"].as_str().unwrap_or("read") {
                "read" => format!("Reading {app}"),
                "keys" => format!("Pressing keys in {app}"),
                "type_here" => "Typing".into(),
                "click_text" => quoted("Clicking", arg("text")),
                _ => match args["do"].as_str() {
                    Some("type") => format!("Typing in {app}"),
                    _ => format!("Working in {app}"),
                },
            }
        }
        BROWSER => match args["action"].as_str().unwrap_or("read") {
            "open" => match arg("url") {
                Some(u) => format!("Opening {}", host(u)),
                None => "Opening a page".into(),
            },
            "read" | "tabs" => "Reading the page".into(),
            _ => "Working in your browser".into(),
        },
        APP_ACTION => "Preparing the change".into(),
        APPS => quoted("Looking up", arg("name")),
        OFFICE => match args["action"].as_str().unwrap_or_default() {
            "email_draft" => "Drafting the email".into(),
            "excel_read" => "Reading the spreadsheet".into(),
            "excel_write" => "Filling the spreadsheet".into(),
            "word_create" | "to_pdf" => "Making the document".into(),
            _ => "Working in Office".into(),
        },
        RECIPES => "Updating recipes".into(),
        REMEMBER => "Remembering that".into(),
        TODAY => "Checking your day".into(),
        RECENT => "Looking at what just happened".into(),
        PROPOSE => "Preparing an action".into(),
        _ => String::new(),
    }
}
