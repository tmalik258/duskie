//! Tool calls a local model wrote as text instead of real calls, as some
//! coding models do: `{"name": "write_file", "arguments": {...}}`, bare or
//! inside a code fence or `<tool_call>` tags.

use serde_json::{Value, json};

const TOOLS: &[&str] = &["list_files", "read_file", "search", "write_file"];

/// The calls in `text`, shaped like Ollama's `tool_calls`.
pub fn text_calls(text: &str) -> Vec<Value> {
    let mut out = Vec::new();
    let mut at = 0;
    while let Some(i) = text[at..].find('{') {
        let start = at + i;
        let mut stream = serde_json::Deserializer::from_str(&text[start..]).into_iter::<Value>();
        match stream.next() {
            Some(Ok(v)) => {
                if let Some(call) = as_call(&v) {
                    out.push(call);
                }
                at = start + stream.byte_offset().max(1);
            }
            _ => at = start + 1,
        }
    }
    out
}

fn as_call(v: &Value) -> Option<Value> {
    let name = v["name"].as_str().filter(|n| TOOLS.contains(n))?;
    let args = [&v["arguments"], &v["parameters"]]
        .into_iter()
        .find(|a| a.is_object())?;
    Some(json!({"function": {"name": name, "arguments": args}}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_calls_written_as_text() {
        let t = "I'll fix it.\n```json\n{\"name\": \"write_file\", \"arguments\": {\"path\": \"a.txt\", \"content\": \"hi {x}\"}}\n```";
        let calls = text_calls(t);
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0]["function"]["arguments"]["content"], "hi {x}");
    }

    #[test]
    fn ignores_other_json() {
        assert!(text_calls("Use {\"a\": 1} or {\"name\": \"rm\", \"arguments\": {}}").is_empty());
        assert_eq!(
            text_calls(
                "<tool_call>{\"name\":\"read_file\",\"parameters\":{\"path\":\"x\"}}</tool_call>"
            )
            .len(),
            1
        );
    }
}
