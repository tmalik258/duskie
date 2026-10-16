//! The editor's file access, all confined to the project folder.

use crate::workspace::{self, Hit, OpenFile, TreeEntry};

use super::*;

fn e(err: std::io::Error) -> String {
    err.to_string()
}

#[tauri::command]
pub async fn editor_tree(root: String) -> CmdResult<Vec<TreeEntry>> {
    off_ui(move || workspace::tree(&workspace::root_of(&root).map_err(e)?).map_err(e)).await?
}

#[tauri::command]
pub async fn editor_read(root: String, path: String) -> CmdResult<OpenFile> {
    off_ui(move || workspace::read(&workspace::root_of(&root).map_err(e)?, &path).map_err(e))
        .await?
}

/// Saves when the file is unchanged since `stamp`; returns the new stamp.
#[tauri::command]
pub async fn editor_write(
    root: String,
    path: String,
    text: String,
    stamp: String,
) -> CmdResult<String> {
    off_ui(move || {
        workspace::write(&workspace::root_of(&root).map_err(e)?, &path, &text, &stamp).map_err(e)
    })
    .await?
}

#[tauri::command]
pub async fn editor_changed(root: String, path: String, stamp: String) -> CmdResult<bool> {
    off_ui(move || {
        workspace::changed(&workspace::root_of(&root).map_err(e)?, &path, &stamp).map_err(e)
    })
    .await?
}

#[tauri::command]
pub async fn editor_head(root: String, path: String) -> CmdResult<String> {
    off_ui(move || workspace::head(&workspace::root_of(&root).map_err(e)?, &path).map_err(e))
        .await?
}

#[tauri::command]
pub async fn editor_search(root: String, query: String) -> CmdResult<Vec<Hit>> {
    off_ui(move || workspace::search(&workspace::root_of(&root).map_err(e)?, &query).map_err(e))
        .await?
}
