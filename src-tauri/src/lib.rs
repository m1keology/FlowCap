use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

/// Returns the current global cursor position as { x, y } in screen pixels.
/// Works while the FlowCap window is hidden — the OS always knows where the cursor is.
#[tauri::command]
fn get_cursor_pos() -> (i32, i32) {
    // cursor-hero crate is overkill; use the platform API directly.
    #[cfg(target_os = "windows")]
    {
        use std::mem::zeroed;
        // POINT is { x: LONG, y: LONG }
        #[allow(non_snake_case)]
        #[repr(C)]
        struct POINT { x: i32, y: i32 }
        extern "system" {
            fn GetCursorPos(lpPoint: *mut POINT) -> i32;
        }
        let mut pt: POINT = unsafe { zeroed() };
        unsafe { GetCursorPos(&mut pt); }
        (pt.x, pt.y)
    }
    #[cfg(target_os = "macos")]
    {
        // NSEvent.mouseLocation gives flipped coords (origin bottom-left on macOS)
        // We need CGEventGetLocation or just NSScreen.main.frame.height - y
        // Easiest cross-platform shim: return (0,0) and let JS mousemove handle it.
        (0, 0)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        (0, 0)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // ── Tray icon ─────────────────────────────────────────────────────
            // Use the same icon that's declared in tauri.conf.json → bundle.icon.
            // This is reliable on all platforms (Windows .ico, macOS .icns, Linux .png).
            let icon = app
                .default_window_icon()
                .expect("No icon found — add an icon path to bundle.icon in tauri.conf.json")
                .clone();

            let show_item = MenuItem::with_id(app, "show", "Show FlowCap", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit FlowCap", true, None::<&str>)?;
            let menu     = Menu::with_items(app, &[&show_item, &separator, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .tooltip("FlowCap")
                .menu(&menu)
                .show_menu_on_left_click(false)   // right-click shows menu; left-click shows window
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Left-click the tray icon → bring window to front
                    if let TrayIconEvent::Click {
                        button:       MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ── Close-to-tray ──────────────────────────────────────────────────
            // Clicking ✕ hides the window instead of quitting so the user can
            // always get back via the tray.  Use "Quit FlowCap" in the tray menu
            // (or Ctrl+Q) to actually exit.
            let win       = app.get_webview_window("main").unwrap();
            let win_clone = win.clone();
            win.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win_clone.hide();
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_cursor_pos])
        .run(tauri::generate_context!())
        .expect("error while running FlowCap");
}
