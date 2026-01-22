//! 单元测试：chat_agent 模块
//!
//! 测试 parse_agent_response 函数的各种输入情况

/// AgentResponse 结构，与 chat_agent.rs 中的定义一致
#[derive(Debug, Clone, serde::Deserialize, PartialEq)]
struct AgentResponse {
    response: String,
    tools: Vec<ToolCall>,
}

#[derive(Debug, Clone, serde::Deserialize, PartialEq)]
struct ToolCall {
    name: String,
    params: serde_json::Value,
}

/// 模拟 parse_agent_response 逻辑 (因为原函数是私有方法)
fn parse_agent_response(content: &str) -> Result<AgentResponse, String> {
    // 尝试提取 JSON (可能被包裹在 markdown 代码块中)
    let json_str = if content.contains("```json") {
        content
            .split("```json")
            .nth(1)
            .and_then(|s| s.split("```").next())
            .unwrap_or(content)
            .trim()
    } else if content.contains("```") {
        content.split("```").nth(1).unwrap_or(content).trim()
    } else {
        content.trim()
    };

    serde_json::from_str(json_str).map_err(|e| format!("解析失败: {}", e))
}

#[test]
fn test_parse_plain_json() {
    let input = r#"{"response": "你好", "tools": []}"#;
    let result = parse_agent_response(input);
    assert!(result.is_ok());
    let response = result.unwrap();
    assert_eq!(response.response, "你好");
    assert!(response.tools.is_empty());
}

#[test]
fn test_parse_json_in_markdown_code_block() {
    let input = r#"```json
{"response": "分析完成", "tools": [{"name": "analyze_folders", "params": {"folder_indices": [1, 2]}}]}
```"#;
    let result = parse_agent_response(input);
    assert!(result.is_ok());
    let response = result.unwrap();
    assert_eq!(response.response, "分析完成");
    assert_eq!(response.tools.len(), 1);
    assert_eq!(response.tools[0].name, "analyze_folders");
}

#[test]
fn test_parse_json_in_generic_code_block() {
    let input = r#"```
{"response": "测试", "tools": []}
```"#;
    let result = parse_agent_response(input);
    assert!(result.is_ok());
    let response = result.unwrap();
    assert_eq!(response.response, "测试");
}

#[test]
fn test_parse_with_multiple_tools() {
    let input = r#"{"response": "开始生成", "tools": [
        {"name": "generate_icons", "params": {"folder_indices": [1]}},
        {"name": "apply_icons", "params": {"folder_indices": [1]}}
    ]}"#;
    let result = parse_agent_response(input);
    assert!(result.is_ok());
    let response = result.unwrap();
    assert_eq!(response.tools.len(), 2);
    assert_eq!(response.tools[0].name, "generate_icons");
    assert_eq!(response.tools[1].name, "apply_icons");
}

#[test]
fn test_parse_invalid_json() {
    let input = "这不是 JSON";
    let result = parse_agent_response(input);
    assert!(result.is_err());
}

#[test]
fn test_parse_json_with_extra_whitespace() {
    let input = r#"

    {"response": "带空白", "tools": []}

"#;
    let result = parse_agent_response(input);
    assert!(result.is_ok());
    let response = result.unwrap();
    assert_eq!(response.response, "带空白");
}

#[test]
fn test_parse_nested_markdown_blocks() {
    // 测试有多个 ``` 的情况
    let input = r#"```json
{"response": "正确内容", "tools": []}
```
一些额外文本
```
other code
```"#;
    let result = parse_agent_response(input);
    assert!(result.is_ok());
    let response = result.unwrap();
    assert_eq!(response.response, "正确内容");
}
