// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use std::collections::HashMap;

/// 自用：通用 HTTP 代理命令。
/// http 插件的 fetch 受 ACL scope 限制（默认不允许任何 URL），
/// 用户自定义端点的地址不可预知，因此在 Rust 侧提供无 scope 限制的直连通道作为回退。
#[derive(serde::Deserialize)]
struct ProxyFetchRequest {
    url: String,
    #[serde(default)]
    method: Option<String>,
    #[serde(default)]
    headers: Option<HashMap<String, String>>,
    #[serde(default)]
    body: Option<String>,
}

#[derive(serde::Serialize)]
struct ProxyFetchResponse {
    status: u16,
    headers: HashMap<String, String>,
    body_base64: String,
}

#[tauri::command]
async fn proxy_fetch(request: ProxyFetchRequest) -> Result<ProxyFetchResponse, String> {
    use tauri_plugin_http::reqwest;

    let method_name = request.method.unwrap_or_else(|| "GET".to_string());
    let method = reqwest::Method::from_bytes(method_name.to_uppercase().as_bytes())
        .map_err(|e| format!("无效的 HTTP 方法「{method_name}」: {e}"))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {e}"))?;

    let mut req = client.request(method, &request.url);
    if let Some(headers) = &request.headers {
        for (key, value) in headers {
            req = req.header(key, value);
        }
    }
    if let Some(body) = &request.body {
        req = req.body(body.clone());
    }

    let response = req.send().await.map_err(|e| {
        if e.is_timeout() {
            "上游接口请求超时（300s），请稍后重试。".to_string()
        } else if e.is_connect() {
            format!("无法连接到上游接口: {e}")
        } else {
            format!("上游接口请求失败: {e}")
        }
    })?;

    let status = response.status().as_u16();
    let mut headers_map = HashMap::new();
    for (name, value) in response.headers() {
        if let Ok(v) = value.to_str() {
            headers_map.insert(name.as_str().to_string(), v.to_string());
        }
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取上游响应失败: {e}"))?;

    Ok(ProxyFetchResponse {
        status,
        headers: headers_map,
        body_base64: BASE64.encode(&bytes),
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![proxy_fetch])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
