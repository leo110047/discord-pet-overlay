// Discord Pet Overlay - Tauri 後端

use sysinfo::System;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder,
};

#[cfg(target_os = "macos")]
use tauri::{ActivationPolicy, RunEvent};

/// 檢查 Discord 是否正在運行
#[tauri::command]
fn is_discord_running() -> bool {
    let s = System::new_all();

    for process in s.processes().values() {
        let name = process.name().to_string_lossy().to_lowercase();
        // macOS: "Discord", Windows: "Discord.exe", Linux: "discord"
        if name.contains("discord") {
            return true;
        }
    }

    false
}

/// 打開設定視窗
fn open_settings_window(app: &tauri::AppHandle) {
    // 檢查設定視窗是否已存在
    if let Some(window) = app.get_webview_window("settings") {
        // 如果已存在，顯示並聚焦
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        // 如果不存在，建立新視窗
        let _ = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("/settings.html".into()))
            .title("設定 - Discord Pet Overlay")
            .inner_size(400.0, 600.0)
            .min_inner_size(360.0, 400.0)
            .resizable(true)
            .center()
            .build();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 當嘗試開啟第二個實例時，顯示設定視窗
            open_settings_window(app);
        }))
        .invoke_handler(tauri::generate_handler![is_discord_running])
        .setup(|app| {
            // 建立托盤選單（只保留設定和結束）
            let settings_item = MenuItem::with_id(app, "settings", "設定", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "結束", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&settings_item, &quit_item])?;

            // 建立系統托盤圖示
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "settings" => {
                        open_settings_window(app);
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // 左鍵點擊托盤圖示時開啟設定視窗
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        open_settings_window(app);
                    }
                })
                .build(app)?;

            // 設定為 Accessory 模式，讓 Dock 圖示可以點擊但不常駐
            #[cfg(target_os = "macos")]
            app.set_activation_policy(ActivationPolicy::Accessory);

            // 應用程式啟動時自動開啟設定視窗
            open_settings_window(app.handle());

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            // 處理 macOS Dock 圖示點擊（reopen 事件）
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { .. } = _event {
                open_settings_window(_app);
            }
        });
}
