//! What the Git dock needs: the changed files, staging, amend, and the
//! capped diff a model reads to write a commit message. Each call runs git
//! on a worker thread and names a repository by its folder.

use std::path::PathBuf;

use duskie_actions::gitflow::{self, FileChange};
use serde::Serialize;

use super::*;

/// Characters of diff a model reads for a commit message.
const MESSAGE_DIFF_CHARS: usize = 12_000;

fn err(e: duskie_actions::ActionError) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn git_status(path: String) -> CmdResult<Vec<FileChange>> {
    off_ui(move || gitflow::status(&PathBuf::from(path)).map_err(err)).await?
}

/// Stages the files, or everything when the list is empty.
#[tauri::command]
pub async fn git_stage(path: String, files: Vec<String>) -> CmdResult<String> {
    off_ui(move || {
        gitflow::stage(&PathBuf::from(path), &files)
            .map(|o| o.message)
            .map_err(err)
    })
    .await?
}

/// Unstages the files, or everything when the list is empty.
#[tauri::command]
pub async fn git_unstage(path: String, files: Vec<String>) -> CmdResult<String> {
    off_ui(move || {
        gitflow::unstage(&PathBuf::from(path), &files)
            .map(|o| o.message)
            .map_err(err)
    })
    .await?
}

/// Amends the last commit with what is staged. `pushed` tells the dock to
/// warn first: it would need a force push.
#[tauri::command]
pub async fn git_amend(path: String, message: Option<String>) -> CmdResult<String> {
    off_ui(move || {
        gitflow::amend(&PathBuf::from(path), message.as_deref())
            .map(|o| o.message)
            .map_err(err)
    })
    .await?
}

#[tauri::command]
pub async fn git_last_commit_pushed(path: String) -> CmdResult<bool> {
    off_ui(move || gitflow::last_commit_pushed(&PathBuf::from(path))).await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageDiff {
    pub text: String,
    /// Files the text still covers, and how many changed in all.
    pub covered: usize,
    pub total: usize,
}

/// The staged diff (or every tracked change), cut to a size a model can
/// read, for the sparkle button beside the commit message.
#[tauri::command]
pub async fn git_message_diff(path: String) -> CmdResult<MessageDiff> {
    off_ui(move || {
        gitflow::diff_for_message(&PathBuf::from(path), MESSAGE_DIFF_CHARS)
            .map(|(text, covered, total)| MessageDiff {
                text,
                covered,
                total,
            })
            .map_err(err)
    })
    .await?
}
