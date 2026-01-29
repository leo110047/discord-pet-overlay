// ODANGO - 主程式入口
// 阻止 Windows 上的額外 console 視窗出現
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    odango_lib::run()
}
